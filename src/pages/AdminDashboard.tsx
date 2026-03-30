import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { LogOut, User, Mail, Shield, Building2, Users, GraduationCap, BookOpen, Plus, Upload, Sparkles, Send, AlertTriangle, CheckCircle2, Loader2, ClipboardList } from 'lucide-react';
import { adminAccountManagementService } from '@/services/adminAccountManagementService';
import { getAcademicContext, updateAcademicContext } from '@/services/adminService';
import { generateNoDueRequests } from '@/services/noDueAutomationService';
import { getStudentsReadyForHallTicket } from '@/services/mentorApprovalService';
import { downloadHallTicket } from '@/services/hallTicketService';
import { calculateSemester, AcademicContext } from '@/types/schema';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, setDoc, where, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];
const SEMESTER_OPTIONS = Array.from({ length: 8 }, (_, i) => i + 1);

type EligibleStudentRecord = {
  id: string;
  usn: string;
  name: string;
  section: string;
  mentorEmployeeId?: string;
  currentSemester: number | null;
};

type BatchGenerationResult = {
  usn: string;
  name: string;
  requestsCreated: number;
  errors: string[];
  success: boolean;
};

type SubjectAssignmentRow = {
  subjectCode: string;
  subjectName: string;
  section: string;
  teacherEmployeeId: string;
  teacherName: string;
  subjectType: 'core' | 'open_elective';
};

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check if super admin (ADMIN001 or admin without specific department)
  const isSuperAdmin = (user?.role === 'department_admin' && 'adminId' in user && user.adminId === 'ADMIN001') || 
                       (user?.role === 'department_admin' && !user?.departmentId);
  const isDeptAdmin = !isSuperAdmin && !!user?.departmentId;
  
  // Department options
  const departments = ['CSE', 'ISE', 'AIML', 'ECE', 'EEE', 'MECHANICAL', 'ALL'];
  
  // Dialog states
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [curriculumDialogOpen, setCurriculumDialogOpen] = useState(false);
  const [teacherMappingDialogOpen, setTeacherMappingDialogOpen] = useState(false);
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [openElectiveDialogOpen, setOpenElectiveDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contextUpdating, setContextUpdating] = useState(false);
  const [openElectiveSubmitting, setOpenElectiveSubmitting] = useState(false);
  
  // Student form
  const [studentForm, setStudentForm] = useState({
    usn: '',
    name: '',
    email: '',
    dateOfBirth: '',
    departmentId: isDeptAdmin ? user?.departmentId || 'CSE' : 'CSE',
    batchYear: new Date().getFullYear(),
    section: 'A',
    mentorEmployeeId: ''
  });
  
  // Teacher form
  const [teacherForm, setTeacherForm] = useState({
    employeeId: '',
    name: '',
    designation: '',
    email: '',
    departmentId: isDeptAdmin ? user?.departmentId || 'CSE' : 'CSE',
    role: 'faculty' as 'faculty' | 'librarian' | 'accounts' | 'sports' | 'admin',
    temporaryPassword: ''
  });
  
  // Admin form
  const [adminForm, setAdminForm] = useState({
    adminId: '',
    name: '',
    email: '',
    departmentId: 'CSE',
    temporaryPassword: ''
  });
  
  // Curriculum form
  const [curriculumForm, setCurriculumForm] = useState({
    departmentId: user?.departmentId || 'CSE',
    batchYear: new Date().getFullYear(),
    semesterNumber: 1,
    subjectCode: '',
    subjectName: '',
    subjectType: 'core' as 'core' | 'open_elective'
  });
  
  // Teacher-Subject Mapping form
  const [teacherMappingForm, setTeacherMappingForm] = useState({
    departmentId: user?.departmentId || 'CSE',
    batchYear: new Date().getFullYear(),
    semesterNumber: 1,
    section: 'A',
    subjectCode: '',
    teacherEmployeeId: ''
  });
  const [openElectiveForm, setOpenElectiveForm] = useState({
    usn: '',
    semesterNumber: 1,
    subjectCode: ''
  });

  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentFilters, setAssignmentFilters] = useState({
    departmentId: isSuperAdmin ? '' : user?.departmentId || '',
    batchYear: String(new Date().getFullYear()),
    semesterNumber: '1',
  });
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [coreAssignments, setCoreAssignments] = useState<SubjectAssignmentRow[]>([]);
  const [openElectiveAssignments, setOpenElectiveAssignments] = useState<SubjectAssignmentRow[]>([]);
  const [assignmentsFetched, setAssignmentsFetched] = useState(false);

  const [noDueDialogOpen, setNoDueDialogOpen] = useState(false);
  const [hallTicketDialogOpen, setHallTicketDialogOpen] = useState(false);
  const [hallTicketLoading, setHallTicketLoading] = useState(false);
  const [hallTicketCandidates, setHallTicketCandidates] = useState<Array<{
    usn: string;
    studentName: string;
    semesterNumber: number;
    section: string;
    mentorApprovedAt: Date;
  }>>([]);
  const [hallTicketDepartment, setHallTicketDepartment] = useState(isSuperAdmin ? '' : user?.departmentId || '');
  const [examDateDialogOpen, setExamDateDialogOpen] = useState(false);
  const [examDateSemester, setExamDateSemester] = useState('1');
  const [examDateLoading, setExamDateLoading] = useState(false);
  const [examDateRows, setExamDateRows] = useState<Array<{ subjectCode: string; subjectName: string; examDate: string }>>([]);
  
  // Clearance Assignments state
  const [clearanceAssignmentDialogOpen, setClearanceAssignmentDialogOpen] = useState(false);
  const [clearanceFilters, setClearanceFilters] = useState({
    departmentId: isSuperAdmin ? '' : user?.departmentId || '',
    clearanceType: 'sports', // 'sports' or 'certificate'
  });
  const [clearanceAssignmentLoading, setClearanceAssignmentLoading] = useState(false);
  const [clearanceAssignmentError, setClearanceAssignmentError] = useState<string | null>(null);
  const [clearanceAssignments, setClearanceAssignments] = useState<Array<{
    clearanceType: 'sports' | 'certificate';
    departmentId: string;
    assignedTeacher?: { employeeId: string; name: string };
  }>>([]);
  const [selectedClearanceTeacher, setSelectedClearanceTeacher] = useState<string>('');
  const [clearanceSubmitting, setClearanceSubmitting] = useState(false);
  const [noDueForm, setNoDueForm] = useState<{
    departmentId: string;
    batchYear: string;
    semesterNumber: number;
    section: string;
  }>({
    departmentId: isSuperAdmin ? '' : user?.departmentId || '',
    batchYear: String(new Date().getFullYear()),
    semesterNumber: 1,
    section: 'A',
  });
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudentRecord[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleError, setEligibleError] = useState<string | null>(null);
  const [selectedUsns, setSelectedUsns] = useState<string[]>([]);
  const [generatingNoDue, setGeneratingNoDue] = useState(false);
  const [generationResults, setGenerationResults] = useState<BatchGenerationResult[] | null>(null);

  const [entityCounts, setEntityCounts] = useState({ students: 0, teachers: 0 });
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);
  const [viewStudentsOpen, setViewStudentsOpen] = useState(false);
  const [viewTeachersOpen, setViewTeachersOpen] = useState(false);
  const [studentList, setStudentList] = useState<any[]>([]);
  const [teacherList, setTeacherList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState({ students: false, teachers: false });
  const [listError, setListError] = useState<string | null>(null);
  const [studentFilters, setStudentFilters] = useState({ name: '', usn: '', semester: 'all', section: 'all' });
  const [teacherFilters, setTeacherFilters] = useState({ name: '', employeeId: '' });
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentDetailOpen, setStudentDetailOpen] = useState(false);
  const [studentEditMode, setStudentEditMode] = useState(false);
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentEditForm, setStudentEditForm] = useState({
    name: '',
    email: '',
    dateOfBirth: '',
    departmentId: '',
    batchYear: '',
    section: '',
    mentorEmployeeId: '',
  });
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [teacherDetailOpen, setTeacherDetailOpen] = useState(false);
  const [teacherEditMode, setTeacherEditMode] = useState(false);
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherEditForm, setTeacherEditForm] = useState({
    name: '',
    designation: '',
    email: '',
    departmentId: '',
    role: 'faculty' as 'faculty' | 'librarian' | 'accounts' | 'sports' | 'admin',
  });
  const [curriculumListOpen, setCurriculumListOpen] = useState(false);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [curriculumList, setCurriculumList] = useState<any[]>([]);
  const [curriculumFilters, setCurriculumFilters] = useState({
    departmentId: isSuperAdmin ? '' : user?.departmentId || '',
    batchYear: '',
    semesterNumber: 'all',
    subjectCode: '',
  });
  const [curriculumEditOpen, setCurriculumEditOpen] = useState(false);
  const [curriculumSaving, setCurriculumSaving] = useState(false);
  const [curriculumEditForm, setCurriculumEditForm] = useState({
    docId: '',
    subjectName: '',
    subjectType: 'core' as 'core' | 'open_elective',
  });
  const [mappingEditOpen, setMappingEditOpen] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingEditForm, setMappingEditForm] = useState({
    departmentId: '',
    batchYear: '',
    semesterNumber: '',
    section: '',
    subjectCode: '',
    teacherEmployeeId: '',
  });
  const [openElectiveEditOpen, setOpenElectiveEditOpen] = useState(false);
  const [openElectiveSaving, setOpenElectiveSaving] = useState(false);
  const [openElectiveEditForm, setOpenElectiveEditForm] = useState({
    departmentId: '',
    batchYear: '',
    semesterNumber: '',
    subjectCode: '',
    section: '',
    subjectName: '',
    teacherEmployeeId: '',
  });
  const [academicContext, setAcademicContext] = useState<AcademicContext | null>(null);
  const [academicContextError, setAcademicContextError] = useState<string | null>(null);
  const [contextForm, setContextForm] = useState<{ academicYear: string; semesterType: 'odd' | 'even' }>(
    { academicYear: '', semesterType: 'odd' }
  );

  useEffect(() => {
    let isMounted = true;

    const fetchAcademicContext = async () => {
      try {
        const context = await getAcademicContext();
        if (!isMounted) {
          return;
        }
        setAcademicContext(context);
        setAcademicContextError(null);
      } catch (error) {
        console.error('Error loading academic context:', error);
        if (!isMounted) {
          return;
        }
        setAcademicContext(null);
        setAcademicContextError('Academic context not configured. Semester data may be unavailable.');
      }
    };

    fetchAcademicContext();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (academicContext) {
      setContextForm({
        academicYear: academicContext.academicYear,
        semesterType: academicContext.semesterType,
      });
    }
  }, [academicContext]);

  useEffect(() => {
    if (isDeptAdmin && user?.departmentId) {
      setNoDueForm((prev) => ({ ...prev, departmentId: user.departmentId }));
    }
  }, [isDeptAdmin, user?.departmentId]);

  useEffect(() => {
    if (!isSuperAdmin && user?.departmentId) {
      setAssignmentFilters((prev) => ({ ...prev, departmentId: user.departmentId }));
    }
  }, [isSuperAdmin, user?.departmentId]);

  useEffect(() => {
    if (!isSuperAdmin && user?.departmentId) {
      setHallTicketDepartment(user.departmentId);
    }
  }, [isSuperAdmin, user?.departmentId]);

  useEffect(() => {
    if (selectedStudent && studentDetailOpen) {
      setStudentEditForm({
        name: selectedStudent.name || '',
        email: selectedStudent.email || '',
        dateOfBirth: selectedStudent.dateOfBirth || '',
        departmentId: selectedStudent.departmentId || '',
        batchYear: String(selectedStudent.batchYear || ''),
        section: selectedStudent.section || '',
        mentorEmployeeId: selectedStudent.mentorEmployeeId || '',
      });
    }
  }, [selectedStudent, studentDetailOpen]);

  useEffect(() => {
    if (selectedTeacher && teacherDetailOpen) {
      setTeacherEditForm({
        name: selectedTeacher.name || '',
        designation: selectedTeacher.designation || '',
        email: selectedTeacher.email || '',
        departmentId: selectedTeacher.departmentId || '',
        role: selectedTeacher.role || 'faculty',
      });
    }
  }, [selectedTeacher, teacherDetailOpen]);

  const handleSaveStudent = async () => {
    if (!selectedStudent) return;
    try {
      setStudentSaving(true);
      const studentRef = doc(db, 'students', selectedStudent.usn);
      await setDoc(
        studentRef,
        {
          name: studentEditForm.name.trim(),
          email: studentEditForm.email.trim(),
          dateOfBirth: studentEditForm.dateOfBirth.trim(),
          departmentId: studentEditForm.departmentId.trim(),
          batchYear: parseInt(studentEditForm.batchYear, 10),
          section: studentEditForm.section.trim().toUpperCase(),
          mentorEmployeeId: studentEditForm.mentorEmployeeId.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({ title: 'Student updated', description: 'Student details saved successfully.' });
      setStudentEditMode(false);
      await loadStudents();
    } catch (error) {
      console.error('Error updating student:', error);
      toast({ title: 'Update failed', description: 'Could not update student details.', variant: 'destructive' });
    } finally {
      setStudentSaving(false);
    }
  };

  const handleSaveTeacher = async () => {
    if (!selectedTeacher) return;
    try {
      setTeacherSaving(true);
      const teacherRef = doc(db, 'teachers', selectedTeacher.employeeId);
      await setDoc(
        teacherRef,
        {
          name: teacherEditForm.name.trim(),
          designation: teacherEditForm.designation.trim(),
          email: teacherEditForm.email.trim(),
          departmentId: teacherEditForm.departmentId.trim(),
          role: teacherEditForm.role,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({ title: 'Teacher updated', description: 'Teacher details saved successfully.' });
      setTeacherEditMode(false);
      await loadTeachers();
    } catch (error) {
      console.error('Error updating teacher:', error);
      toast({ title: 'Update failed', description: 'Could not update teacher details.', variant: 'destructive' });
    } finally {
      setTeacherSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    if (!window.confirm(`Delete student ${selectedStudent.usn}?`)) return;
    try {
      await deleteDoc(doc(db, 'students', selectedStudent.usn));
      toast({ title: 'Student deleted', description: `${selectedStudent.usn} removed.` });
      setStudentDetailOpen(false);
      await loadStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({ title: 'Delete failed', description: 'Could not delete student.', variant: 'destructive' });
    }
  };

  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;
    if (!window.confirm(`Delete teacher ${selectedTeacher.employeeId}?`)) return;
    try {
      await deleteDoc(doc(db, 'teachers', selectedTeacher.employeeId));
      toast({ title: 'Teacher deleted', description: `${selectedTeacher.employeeId} removed.` });
      setTeacherDetailOpen(false);
      await loadTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      toast({ title: 'Delete failed', description: 'Could not delete teacher.', variant: 'destructive' });
    }
  };

  const loadCurriculumList = async () => {
    try {
      setCurriculumLoading(true);
      const departmentScope = isSuperAdmin ? null : user?.departmentId;
      const baseRef = collection(db, 'curriculum');
      const baseQuery = departmentScope
        ? query(baseRef, where('departmentId', '==', departmentScope))
        : baseRef;
      const snap = await getDocs(baseQuery);
      const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const filtered = items.filter((item: any) => {
        if (curriculumFilters.departmentId && item.departmentId !== curriculumFilters.departmentId) return false;
        if (curriculumFilters.batchYear && String(item.batchYear) !== String(curriculumFilters.batchYear)) return false;
        if (curriculumFilters.semesterNumber !== 'all' && String(item.semesterNumber) !== curriculumFilters.semesterNumber) return false;
        if (curriculumFilters.subjectCode && !String(item.subjectCode || '').toUpperCase().includes(curriculumFilters.subjectCode.toUpperCase())) return false;
        return true;
      });
      setCurriculumList(filtered);
    } catch (error) {
      console.error('Error loading curriculum list:', error);
      toast({ title: 'Failed to load curriculum', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setCurriculumLoading(false);
    }
  };

  const handleSaveCurriculum = async () => {
    if (!curriculumEditForm.docId) return;
    try {
      setCurriculumSaving(true);
      await setDoc(
        doc(db, 'curriculum', curriculumEditForm.docId),
        {
          subjectName: curriculumEditForm.subjectName.trim(),
          subjectType: curriculumEditForm.subjectType,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({ title: 'Curriculum updated', description: 'Subject details saved successfully.' });
      setCurriculumEditOpen(false);
      await loadCurriculumList();
    } catch (error) {
      console.error('Error updating curriculum:', error);
      toast({ title: 'Update failed', description: 'Could not update curriculum.', variant: 'destructive' });
    } finally {
      setCurriculumSaving(false);
    }
  };

  const handleSaveMapping = async () => {
    const { departmentId, batchYear, semesterNumber, section, subjectCode, teacherEmployeeId } = mappingEditForm;
    if (!departmentId || !batchYear || !semesterNumber || !section || !subjectCode) return;
    try {
      setMappingSaving(true);
      const docId = `${departmentId}_${batchYear}_${semesterNumber}_${section}_${subjectCode}`;
      await setDoc(
        doc(db, 'core_subject_teacher_mapping', docId),
        {
          departmentId,
          batchYear: parseInt(batchYear, 10),
          semesterNumber: parseInt(semesterNumber, 10),
          section,
          subjectCode,
          teacherEmployeeId: teacherEmployeeId.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({ title: 'Mapping updated', description: 'Teacher assignment saved.' });
      setMappingEditOpen(false);
      await loadTeacherAssignments();
    } catch (error) {
      console.error('Error updating mapping:', error);
      toast({ title: 'Update failed', description: 'Could not update mapping.', variant: 'destructive' });
    } finally {
      setMappingSaving(false);
    }
  };

  const handleSaveOpenElectiveOffering = async () => {
    const { departmentId, batchYear, semesterNumber, subjectCode, section, subjectName, teacherEmployeeId } = openElectiveEditForm;
    if (!departmentId || !batchYear || !semesterNumber || !subjectCode) return;
    try {
      setOpenElectiveSaving(true);
      const docId = `${departmentId}_${batchYear}_${semesterNumber}_${subjectCode}`;
      await setDoc(
        doc(db, 'open_elective_offerings', docId),
        {
          departmentId,
          batchYear: parseInt(batchYear, 10),
          semesterNumber: parseInt(semesterNumber, 10),
          subjectCode,
          section: section.trim().toUpperCase() || 'ALL',
          subjectName: subjectName.trim(),
          teacherEmployeeId: teacherEmployeeId.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({ title: 'Open elective updated', description: 'Open elective offering saved.' });
      setOpenElectiveEditOpen(false);
      await loadTeacherAssignments();
    } catch (error) {
      console.error('Error updating open elective:', error);
      toast({ title: 'Update failed', description: 'Could not update open elective.', variant: 'destructive' });
    } finally {
      setOpenElectiveSaving(false);
    }
  };

  const handleDeleteCoreMapping = async (row: SubjectAssignmentRow) => {
    const departmentId = assignmentFilters.departmentId || user?.departmentId || '';
    const batchYear = assignmentFilters.batchYear;
    const semesterNumber = assignmentFilters.semesterNumber;
    if (!departmentId || !batchYear || !semesterNumber) return;
    if (!window.confirm(`Delete mapping for ${row.subjectCode} (Section ${row.section})?`)) return;
    try {
      const docId = `${departmentId}_${batchYear}_${semesterNumber}_${row.section}_${row.subjectCode}`;
      await deleteDoc(doc(db, 'core_subject_teacher_mapping', docId));
      toast({ title: 'Mapping deleted', description: `${row.subjectCode} section ${row.section} removed.` });
      await loadTeacherAssignments();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast({ title: 'Delete failed', description: 'Could not delete mapping.', variant: 'destructive' });
    }
  };

  const handleDeleteOpenElectiveOffering = async (row: SubjectAssignmentRow) => {
    const departmentId = assignmentFilters.departmentId || user?.departmentId || '';
    const batchYear = assignmentFilters.batchYear;
    const semesterNumber = assignmentFilters.semesterNumber;
    if (!departmentId || !batchYear || !semesterNumber) return;
    if (!window.confirm(`Delete open elective ${row.subjectCode}?`)) return;
    try {
      const docId = `${departmentId}_${batchYear}_${semesterNumber}_${row.subjectCode}`;
      await deleteDoc(doc(db, 'open_elective_offerings', docId));
      toast({ title: 'Open elective deleted', description: `${row.subjectCode} removed.` });
      await loadTeacherAssignments();
    } catch (error) {
      console.error('Error deleting open elective:', error);
      toast({ title: 'Delete failed', description: 'Could not delete open elective.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribers: Array<() => void> = [];
    let studentsReady = false;
    let teachersReady = false;
    setCountsLoading(true);
    setCountsError(null);

    const departmentScope = isSuperAdmin ? null : user.departmentId;

    const finishIfReady = () => {
      if (studentsReady && teachersReady) {
        setCountsLoading(false);
      }
    };

    const handleSnapshotError = (error: unknown) => {
      console.error('Error loading dashboard stats:', error);
      setCountsError('Unable to load latest counts');
      setCountsLoading(false);
    };

    const studentsRef = collection(db, 'students');
    const studentsQuery = departmentScope ? query(studentsRef, where('departmentId', '==', departmentScope)) : studentsRef;
    unsubscribers.push(onSnapshot(studentsQuery, (snapshot) => {
      studentsReady = true;
      setEntityCounts((prev) => ({ ...prev, students: snapshot.size }));
      finishIfReady();
    }, handleSnapshotError));

    const teachersRef = collection(db, 'teachers');
    const teachersQuery = teachersRef;
    unsubscribers.push(onSnapshot(teachersQuery, (snapshot) => {
      teachersReady = true;
      setEntityCounts((prev) => ({ ...prev, teachers: snapshot.size }));
      finishIfReady();
    }, handleSnapshotError));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user, isSuperAdmin]);

  const departmentScope = isSuperAdmin ? null : user?.departmentId || null;

  const deriveSemesterForStudent = (student: any) => {
    if (!academicContext) {
      return null;
    }
    const batchYearValue = typeof student.batchYear === 'number'
      ? student.batchYear
      : parseInt(student.batchYear, 10);
    if (Number.isNaN(batchYearValue)) {
      return null;
    }
    return calculateSemester(batchYearValue, academicContext.academicYear, academicContext.semesterType);
  };

  const loadStudents = async () => {
    setListLoading((prev) => ({ ...prev, students: true }));
    setListError(null);
    try {
      const studentsRef = collection(db, 'students');
      const studentsQuery = departmentScope
        ? query(studentsRef, where('departmentId', '==', departmentScope))
        : query(studentsRef, orderBy('usn'));
      const snapshot = await getDocs(studentsQuery);
      const records = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      const sorted = departmentScope
        ? [...records].sort((a, b) => a.usn.localeCompare(b.usn))
        : records;
      const enriched = sorted.map((student) => ({
        ...student,
        currentSemester: deriveSemesterForStudent(student),
      }));
      setStudentList(enriched);
    } catch (error) {
      console.error('Error loading students:', error);
      setListError('Unable to load student records.');
    } finally {
      setListLoading((prev) => ({ ...prev, students: false }));
    }
  };

  const loadTeachers = async () => {
    setListLoading((prev) => ({ ...prev, teachers: true }));
    setListError(null);
    try {
      const teachersRef = collection(db, 'teachers');
      const teachersQuery = query(teachersRef, orderBy('employeeId'));
      const snapshot = await getDocs(teachersQuery);
      const records = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) }));
      console.log('[AdminDashboard] Loaded teachers:', records.length, records);
      setTeacherList(records);
    } catch (error) {
      console.error('Error loading teachers:', error);
      setListError('Unable to load teacher records.');
    } finally {
      setListLoading((prev) => ({ ...prev, teachers: false }));
    }
  };

  const loadNoDueEligibleStudents = async () => {
    if (!academicContext) {
      toast({
        title: 'Academic context required',
        description: 'Set the active academic year and semester before dispatching no-due requests.',
        variant: 'destructive',
      });
      return;
    }

    const targetDepartment = isSuperAdmin ? noDueForm.departmentId : departmentScope;
    if (!targetDepartment) {
      toast({
        title: 'Choose a department',
        description: 'Select which department this cohort belongs to.',
        variant: 'destructive',
      });
      return;
    }

    const batchYearValue = parseInt(noDueForm.batchYear, 10);
    if (Number.isNaN(batchYearValue)) {
      toast({
        title: 'Invalid batch year',
        description: 'Enter a valid batch year (e.g., 2021).',
        variant: 'destructive',
      });
      return;
    }

    setEligibleLoading(true);
    setEligibleError(null);
    setGenerationResults(null);

    try {
      const studentsRef = collection(db, 'students');
      const studentsQuery = query(studentsRef, where('departmentId', '==', targetDepartment));
      const snapshot = await getDocs(studentsQuery);
      const normalizedSection = noDueForm.section.trim().toUpperCase();

      const mapped: EligibleStudentRecord[] = [];

      snapshot.docs.forEach((docSnap) => {
        const student = { id: docSnap.id, ...(docSnap.data() as any) };
        const studentBatch = typeof student.batchYear === 'number'
          ? student.batchYear
          : parseInt(student.batchYear, 10);
        if (Number.isNaN(studentBatch) || studentBatch !== batchYearValue) {
          return;
        }

        const studentSection = (student.section || '').trim().toUpperCase();
        if (studentSection !== normalizedSection) {
          return;
        }

        const currentSemester = deriveSemesterForStudent(student);
        if (currentSemester !== noDueForm.semesterNumber) {
          return;
        }

        mapped.push({
          id: student.id,
          usn: student.usn,
          name: student.name || 'Unnamed Student',
          section: student.section,
          mentorEmployeeId: student.mentorEmployeeId,
          currentSemester,
        });
      });

      if (mapped.length === 0) {
        setEligibleError('No students matched this department, batch year, section, and semester.');
      }

      setEligibleStudents(mapped);
      setSelectedUsns(mapped.map((student) => student.usn));
    } catch (error) {
      console.error('Error loading no-due cohort:', error);
      setEligibleError('Unable to load students for this cohort.');
    } finally {
      setEligibleLoading(false);
    }
  };

  const handleStudentSelectionChange = (usn: string, checked: boolean | 'indeterminate') => {
    setSelectedUsns((prev) => {
      if (checked === true || checked === 'indeterminate') {
        return prev.includes(usn) ? prev : [...prev, usn];
      }
      return prev.filter((item) => item !== usn);
    });
  };

  const handleSelectAllEligible = (checked: boolean | 'indeterminate') => {
    if (checked === true || checked === 'indeterminate') {
      setSelectedUsns(eligibleStudents.map((student) => student.usn));
      return;
    }
    setSelectedUsns([]);
  };

  const handleGenerateNoDueDispatch = async () => {
    if (eligibleStudents.length === 0) {
      toast({
        title: 'No roster loaded',
        description: 'Fetch the cohort before dispatching requests.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedUsns.length === 0) {
      toast({
        title: 'Select at least one student',
        description: 'Choose the students you want to include in this dispatch.',
        variant: 'destructive',
      });
      return;
    }

    setGeneratingNoDue(true);
    setGenerationResults(null);

    const results: BatchGenerationResult[] = [];

    for (const student of eligibleStudents) {
      if (!selectedUsns.includes(student.usn)) {
        continue;
      }

      try {
        const response = await generateNoDueRequests(student.usn);
        results.push({
          usn: student.usn,
          name: student.name,
          requestsCreated: response.requestsCreated,
          errors: response.errors,
          success: response.success && response.errors.length === 0,
        });
      } catch (error) {
        console.error('Error dispatching no-due requests:', error);
        results.push({
          usn: student.usn,
          name: student.name,
          requestsCreated: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          success: false,
        });
      }
    }

    setGenerationResults(results);
    setGeneratingNoDue(false);

    const successCount = results.filter((result) => result.success).length;
    const issueCount = results.length - successCount;

    toast({
      title: 'No-due requests dispatched',
      description: `${successCount} student${successCount === 1 ? '' : 's'} processed${issueCount ? `, ${issueCount} issue${issueCount === 1 ? '' : 's'} detected` : ''}.`,
      variant: issueCount ? 'destructive' : 'default',
    });
  };

  const filteredStudentList = useMemo(() => {
    return studentList.filter((student) => {
      const matchesName = studentFilters.name
        ? (student.name || '').toLowerCase().includes(studentFilters.name.toLowerCase())
        : true;
      const matchesUsn = studentFilters.usn
        ? (student.usn || '').toLowerCase().includes(studentFilters.usn.toLowerCase())
        : true;
      const matchesSemester = studentFilters.semester !== 'all'
        ? String(student.currentSemester ?? '') === studentFilters.semester
        : true;
      const matchesSection = studentFilters.section !== 'all'
        ? (student.section || '').toUpperCase() === studentFilters.section.toUpperCase()
        : true;
      return matchesName && matchesUsn && matchesSemester && matchesSection;
    });
  }, [studentList, studentFilters]);

  const filteredTeacherList = useMemo(() => {
    return teacherList.filter((teacher) => {
      const matchesName = teacherFilters.name
        ? (teacher.name || '').toLowerCase().includes(teacherFilters.name.toLowerCase())
        : true;
      const matchesId = teacherFilters.employeeId
        ? (teacher.employeeId || '').toLowerCase().includes(teacherFilters.employeeId.toLowerCase())
        : true;
      return matchesName && matchesId;
    });
  }, [teacherList, teacherFilters]);

  const selectedEligibleStudents = useMemo(() => {
    return eligibleStudents.filter((student) => selectedUsns.includes(student.usn));
  }, [eligibleStudents, selectedUsns]);

  const missingMentorSelected = useMemo(() => {
    return selectedEligibleStudents.filter((student) => !student.mentorEmployeeId).length;
  }, [selectedEligibleStudents]);

  const generationSummary = useMemo(() => {
    if (!generationResults || generationResults.length === 0) {
      return null;
    }
    const totalStudents = generationResults.length;
    const totalRequests = generationResults.reduce((sum, result) => sum + result.requestsCreated, 0);
    const cleanSuccess = generationResults.filter((result) => result.success && result.errors.length === 0).length;
    const partial = generationResults.filter((result) => !result.success && result.requestsCreated > 0).length;
    const failures = generationResults.filter((result) => result.requestsCreated === 0).length;
    return { totalStudents, totalRequests, cleanSuccess, partial, failures };
  }, [generationResults]);

  useEffect(() => {
    if (viewStudentsOpen) {
      loadStudents();
    }
  }, [viewStudentsOpen, departmentScope]);

  useEffect(() => {
    if (viewTeachersOpen) {
      loadTeachers();
    }
  }, [viewTeachersOpen, departmentScope]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  const handleAddStudent = async () => {
    setLoading(true);
    try {
      await adminAccountManagementService.createStudentAccount(studentForm, (user as any)?.adminId || 'ADMIN001');
      toast({
        title: "Success",
        description: `Student account created for ${studentForm.name}`,
      });
      setStudentDialogOpen(false);
      setStudentForm({
        usn: '',
        name: '',
        email: '',
        dateOfBirth: '',
        departmentId: user?.departmentId || 'CSE',
        batchYear: new Date().getFullYear(),
        section: 'A',
        mentorEmployeeId: ''
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create student account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddTeacher = async () => {
    setLoading(true);
    try {
      await adminAccountManagementService.createTeacherAccount({
        ...teacherForm,
        teacherRole: teacherForm.role
      }, (user as any)?.adminId || 'ADMIN001');
      toast({
        title: "Success",
        description: `Teacher account created for ${teacherForm.name}`,
      });
      setTeacherDialogOpen(false);
      setTeacherForm({
        employeeId: '',
        name: '',
        designation: '',
        email: '',
        departmentId: user?.departmentId || 'CSE',
        role: 'faculty',
        temporaryPassword: ''
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create teacher account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddAdmin = async () => {
    if (!isSuperAdmin) {
      toast({
        title: 'Not permitted',
        description: 'Only super admins can create new admin accounts.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    console.log('Creating admin account...', adminForm);
    try {
      const result = await adminAccountManagementService.createAdminAccount(adminForm);
      console.log('Admin account created successfully:', result);
      toast({
        title: "Success",
        description: `Admin account created for ${adminForm.name}. Temporary password: ${result.temporaryPassword}`,
      });
      setAdminDialogOpen(false);
      setAdminForm({
        adminId: '',
        name: '',
        email: '',
        departmentId: user?.departmentId || 'CSE',
        temporaryPassword: ''
      });
    } catch (error: any) {
      console.error('Error creating admin account:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create admin account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddCurriculum = async () => {
    setLoading(true);
    try {
      const { departmentId, batchYear, semesterNumber, subjectCode } = curriculumForm;
      const docId = `${departmentId}_${batchYear}_${semesterNumber}_${subjectCode}`;
      
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/config/firebase');
      
      await setDoc(doc(db, 'curriculum', docId), {
        ...curriculumForm,
        createdAt: new Date()
      });
      
      toast({
        title: "Success",
        description: `Subject ${curriculumForm.subjectName} added to curriculum`,
      });
      setCurriculumDialogOpen(false);
      setCurriculumForm({
        departmentId: user?.departmentId || 'CSE',
        batchYear: new Date().getFullYear(),
        semesterNumber: 1,
        subjectCode: '',
        subjectName: '',
        subjectType: 'core'
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add subject to curriculum",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAssignTeacher = async () => {
    setLoading(true);
    try {
      const { departmentId, batchYear, semesterNumber, section, subjectCode } = teacherMappingForm;
      const docId = `${departmentId}_${batchYear}_${semesterNumber}_${section}_${subjectCode}`;
      
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/config/firebase');
      
      await setDoc(doc(db, 'core_subject_teacher_mapping', docId), {
        ...teacherMappingForm,
        createdAt: new Date()
      });
      
      toast({
        title: "Success",
        description: `Teacher ${teacherMappingForm.teacherEmployeeId} assigned to ${teacherMappingForm.subjectCode}`,
      });
      setTeacherMappingDialogOpen(false);
      setTeacherMappingForm({
        departmentId: user?.departmentId || 'CSE',
        batchYear: new Date().getFullYear(),
        semesterNumber: 1,
        section: 'A',
        subjectCode: '',
        teacherEmployeeId: ''
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign teacher to subject",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAcademicContext = async () => {
    if (!contextForm.academicYear.trim()) {
      toast({
        title: 'Academic year required',
        description: 'Please enter the academic year before saving.',
        variant: 'destructive',
      });
      return;
    }

    setContextUpdating(true);
    try {
      const academicYear = contextForm.academicYear.trim();
      await updateAcademicContext(academicYear, contextForm.semesterType);
      setAcademicContext({ academicYear, semesterType: contextForm.semesterType });
      setAcademicContextError(null);
      toast({
        title: 'Academic context updated',
        description: `${academicYear} • ${contextForm.semesterType.toUpperCase()} semester`,
      });
      setContextDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating academic context:', error);
      toast({
        title: 'Update failed',
        description: error?.message || 'Unable to update academic context',
        variant: 'destructive',
      });
    } finally {
      setContextUpdating(false);
    }
  };

  const handleUpdateOpenElectiveChoice = async () => {
    const usn = openElectiveForm.usn.trim().toUpperCase();
    const subjectCode = openElectiveForm.subjectCode.trim().toUpperCase();
    const semesterNumber = openElectiveForm.semesterNumber;

    if (!usn || !semesterNumber || !subjectCode) {
      toast({
        title: 'Missing details',
        description: 'USN, semester, and elective subject code are required.',
        variant: 'destructive',
      });
      return;
    }

    setOpenElectiveSubmitting(true);
    try {
      const studentRef = doc(db, 'students', usn);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        toast({
          title: 'Student not found',
          description: `No record for USN ${usn}.`,
          variant: 'destructive',
        });
        return;
      }

      const studentData = studentSnap.data() as any;

      if (!isSuperAdmin && studentData.departmentId !== user?.departmentId) {
        toast({
          title: 'Not permitted',
          description: 'You can only update students from your department.',
          variant: 'destructive',
        });
        return;
      }

      const batchYearValue = typeof studentData.batchYear === 'number'
        ? studentData.batchYear
        : parseInt(studentData.batchYear, 10);
      if (!studentData.departmentId || Number.isNaN(batchYearValue)) {
        toast({
          title: 'Incomplete student data',
          description: 'Student record is missing department or batch year.',
          variant: 'destructive',
        });
        return;
      }

      const electiveRef = doc(db, 'student_elective_choice', `${usn}_${semesterNumber}`);
      await setDoc(electiveRef, {
        usn,
        batchYear: batchYearValue,
        semesterNumber,
        subjectCode,
        departmentId: studentData.departmentId,
        updatedAt: serverTimestamp(),
        updatedBy: (user as any)?.adminId || user?.uid || user?.email || 'admin',
      }, { merge: true });

      toast({
        title: 'Elective updated',
        description: `${usn} • Semester ${semesterNumber} now mapped to ${subjectCode}.`,
      });
      setOpenElectiveDialogOpen(false);
      setOpenElectiveForm({ usn: '', semesterNumber: 1, subjectCode: '' });
    } catch (error: any) {
      console.error('Error updating elective choice:', error);
      toast({
        title: 'Update failed',
        description: error?.message || 'Unable to update elective choice.',
        variant: 'destructive',
      });
    } finally {
      setOpenElectiveSubmitting(false);
    }
  };

  const loadHallTicketCandidates = async () => {
    const departmentId = isSuperAdmin ? hallTicketDepartment : user?.departmentId;
    if (!departmentId) {
      toast({
        title: 'Select a department',
        description: 'Choose a department to load hall ticket candidates.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setHallTicketLoading(true);
      const data = await getStudentsReadyForHallTicket(departmentId);
      setHallTicketCandidates(data);
    } catch (error) {
      console.error('Error loading hall ticket candidates:', error);
      toast({ title: 'Failed to load hall tickets', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setHallTicketLoading(false);
    }
  };

  const handleGenerateHallTicket = async (usn: string) => {
    try {
      const adminId = (user as any)?.adminId || user?.uid || user?.email || 'admin';
      
      // Generate PDF
      const { generateHallTicket } = await import('@/services/hallTicketService');
      const pdfBlob = await generateHallTicket(usn, adminId);
      
      // Get semester number from student
      const studentRef = doc(db, 'students', usn);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) {
        throw new Error('Student not found');
      }
      const student = studentSnap.data() as any;
      const academicCtx = await getAcademicContext();
      const semesterNumber = calculateSemester(student.batchYear, academicCtx.academicYear, academicCtx.semesterType);
      
      const timestamp = Date.now();
      const docId = `${usn}_${semesterNumber}_${timestamp}`;
      let downloadUrl = '';
      
      // Send PDF to backend for storage
      const formData = new FormData();
      formData.append('usn', usn);
      formData.append('semesterNumber', String(semesterNumber));
      formData.append('generatedBy', adminId);
      formData.append('file', new File([pdfBlob], `HallTicket_${usn}.pdf`, { type: 'application/pdf' }));
      
      try {
        const backendResponse = await fetch('http://localhost:8000/api/hall-tickets/backend-save', {
          method: 'POST',
          body: formData
        });
        
        if (!backendResponse.ok) {
          throw new Error(`Backend save failed: ${backendResponse.status}`);
        }
        
        const backendData = await backendResponse.json();
        downloadUrl = backendData.downloadUrl;
        console.log('[HallTicket] Backend storage successful:', backendData);
      } catch (backendError: any) {
        console.error('[HallTicket] Backend save failed:', backendError);
        throw new Error('Failed to save hall ticket to backend: ' + backendError.message);
      }
      
      // Save metadata to Firestore
      const { serverTimestamp, updateDoc } = await import('firebase/firestore');
      
      console.log('[HallTicket] Saving to Firestore:', {
        docId,
        usn,
        semesterNumber,
        pdfUrl: downloadUrl,
        storageMethod: 'backend'
      });
      
      await setDoc(doc(db, 'hall_tickets', docId), {
        usn,
        semesterNumber,
        generatedAt: serverTimestamp(),
        generatedBy: adminId,
        pdfUrl: downloadUrl,
        fileName: `HallTicket_${usn}.pdf`,
        fileSize: pdfBlob.size,
        storageMethod: 'backend'
      });
      
      console.log('[HallTicket] Saved to Firestore successfully');
      
      // Mark all no_due_requests as hallTicketGenerated
      try {
        const { where, getDocs, query } = await import('firebase/firestore');
        const allRequestsQuery = query(
          collection(db, 'no_due_requests'),
          where('usn', '==', usn)
        );
        const allRequestsSnap = await getDocs(allRequestsQuery);
        
        for (const reqDoc of allRequestsSnap.docs) {
          await updateDoc(doc(db, 'no_due_requests', reqDoc.id), {
            hallTicketGenerated: true,
            hallTicketGeneratedAt: serverTimestamp(),
            hallTicketGeneratedBy: adminId,
            status: 'completed'
          });
        }
      } catch (updateError) {
        console.warn('[HallTicket] Failed to update no_due_requests:', updateError);
      }
      
      // Download for immediate access
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HallTicket_${usn}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      await loadHallTicketCandidates();
      toast({ title: 'Hall ticket generated', description: `Generated and stored hall ticket for ${usn}.` });
    } catch (error: any) {
      console.error('Hall ticket generation error:', error);
      toast({ title: 'Generation failed', description: error?.message || 'Unable to generate hall ticket.', variant: 'destructive' });
    }
  };

  const loadExamDates = async () => {
    const departmentId = isSuperAdmin ? hallTicketDepartment : user?.departmentId;
    if (!departmentId) {
      toast({
        title: 'Select a department',
        description: 'Choose a department before loading exam dates.',
        variant: 'destructive',
      });
      return;
    }

    const semesterNumber = parseInt(examDateSemester, 10);
    if (Number.isNaN(semesterNumber)) {
      toast({
        title: 'Invalid semester',
        description: 'Choose a valid semester.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setExamDateLoading(true);
      const curriculumQuery = query(
        collection(db, 'curriculum'),
        where('departmentId', '==', departmentId),
        where('semesterNumber', '==', semesterNumber)
      );
      const curriculumSnap = await getDocs(curriculumQuery);
      const subjects = curriculumSnap.docs.map((docSnap) => docSnap.data() as any);

      const scheduleQuery = query(
        collection(db, 'exam_schedule'),
        where('departmentId', '==', departmentId),
        where('semesterNumber', '==', semesterNumber)
      );
      const scheduleSnap = await getDocs(scheduleQuery);
      const scheduleMap = new Map<string, string>();
      scheduleSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.subjectCode) {
          scheduleMap.set(String(data.subjectCode).toUpperCase(), normalizeExamDate(data.examDate || ''));
        }
      });

      const rows = subjects
        .map((subject) => ({
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName || subject.subjectCode,
          examDate: scheduleMap.get(String(subject.subjectCode).toUpperCase()) || '',
        }))
        .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));

      setExamDateRows(rows);
    } catch (error) {
      console.error('Error loading exam dates:', error);
      toast({ title: 'Failed to load exam dates', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setExamDateLoading(false);
    }
  };

  const handleSaveExamDates = async () => {
    const departmentId = isSuperAdmin ? hallTicketDepartment : user?.departmentId;
    if (!departmentId) {
      toast({
        title: 'Select a department',
        description: 'Choose a department before saving exam dates.',
        variant: 'destructive',
      });
      return;
    }
    const semesterNumber = parseInt(examDateSemester, 10);
    if (Number.isNaN(semesterNumber)) {
      toast({
        title: 'Invalid semester',
        description: 'Choose a valid semester.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setExamDateLoading(true);
      await Promise.all(
        examDateRows.map((row) => {
          const docId = `${departmentId}_${semesterNumber}_${row.subjectCode}`;
          return setDoc(
            doc(db, 'exam_schedule', docId),
            {
              departmentId,
              semesterNumber,
              subjectCode: row.subjectCode,
              examDate: normalizeExamDate(row.examDate || ''),
              updatedAt: serverTimestamp(),
              updatedBy: (user as any)?.adminId || user?.uid || user?.email || 'admin',
            },
            { merge: true }
          );
        })
      );
      toast({ title: 'Exam dates saved', description: 'Schedule updated successfully.' });
      setExamDateDialogOpen(false);
    } catch (error) {
      console.error('Error saving exam dates:', error);
      toast({ title: 'Save failed', description: 'Could not save exam dates.', variant: 'destructive' });
    } finally {
      setExamDateLoading(false);
    }
  };

  const normalizeExamDate = (value: string): string => {
    if (!value) return '';
    if (value.includes('-')) return value;
    if (value.includes('/')) {
      const [dd, mm, yyyy] = value.split('/');
      if (yyyy && mm && dd) {
        const mmNorm = mm.padStart(2, '0');
        const ddNorm = dd.padStart(2, '0');
        return `${yyyy}-${mmNorm}-${ddNorm}`;
      }
    }
    return value;
  };

  const loadTeacherAssignments = async () => {
    const departmentId = isSuperAdmin ? assignmentFilters.departmentId : user?.departmentId;
    if (!departmentId) {
      toast({
        title: 'Select a department',
        description: 'Choose which department to inspect before loading assignments.',
        variant: 'destructive',
      });
      return;
    }

    const batchYearValue = parseInt(assignmentFilters.batchYear, 10);
    const semesterNumberValue = parseInt(assignmentFilters.semesterNumber, 10);

    if (Number.isNaN(batchYearValue)) {
      toast({
        title: 'Invalid batch year',
        description: 'Enter a valid batch year to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (Number.isNaN(semesterNumberValue)) {
      toast({
        title: 'Invalid semester',
        description: 'Select which semester you want to inspect.',
        variant: 'destructive',
      });
      return;
    }

    setAssignmentsFetched(true);
    setAssignmentLoading(true);
    setAssignmentError(null);
    setCoreAssignments([]);
    setOpenElectiveAssignments([]);

    try {
      const mappingsQuery = query(
        collection(db, 'core_subject_teacher_mapping'),
        where('departmentId', '==', departmentId),
        where('batchYear', '==', batchYearValue),
        where('semesterNumber', '==', semesterNumberValue)
      );
      const mappingsSnap = await getDocs(mappingsQuery);
      const mappingDocs = mappingsSnap.docs.map((docSnap) => docSnap.data() as any);

      const curriculumQuery = query(
        collection(db, 'curriculum'),
        where('departmentId', '==', departmentId),
        where('batchYear', '==', batchYearValue),
        where('semesterNumber', '==', semesterNumberValue)
      );
      const curriculumSnap = await getDocs(curriculumQuery);
      const curriculumMap = new Map<string, string>();
      curriculumSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        curriculumMap.set(data.subjectCode, data.subjectName || data.subjectCode);
      });

      const electivesQuery = query(
        collection(db, 'open_elective_offerings'),
        where('departmentId', '==', departmentId),
        where('batchYear', '==', batchYearValue),
        where('semesterNumber', '==', semesterNumberValue)
      );
      const electivesSnap = await getDocs(electivesQuery);
      const electiveDocs = electivesSnap.docs.map((docSnap) => docSnap.data() as any);

      const teacherIds = new Set<string>();
      mappingDocs.forEach((item) => {
        if (item.teacherEmployeeId) {
          teacherIds.add(item.teacherEmployeeId);
        }
      });
      electiveDocs.forEach((item) => {
        if (item.teacherEmployeeId) {
          teacherIds.add(item.teacherEmployeeId);
        }
      });

      const teacherEntries = await Promise.all(
        Array.from(teacherIds).map(async (employeeId) => {
          const teacherRef = doc(db, 'teachers', employeeId);
          const teacherSnap = await getDoc(teacherRef);
          return teacherSnap.exists() ? { employeeId, ...(teacherSnap.data() as any) } : { employeeId };
        })
      );

      const teacherMap = new Map<string, { name?: string }>();
      teacherEntries.forEach((entry) => {
        if (entry) {
          teacherMap.set(entry.employeeId, { name: entry.name });
        }
      });

      const coreRows: SubjectAssignmentRow[] = mappingDocs.map((mapping: any) => ({
        subjectCode: mapping.subjectCode,
        subjectName: curriculumMap.get(mapping.subjectCode) || mapping.subjectCode,
        section: mapping.section || '—',
        teacherEmployeeId: mapping.teacherEmployeeId,
        teacherName: teacherMap.get(mapping.teacherEmployeeId)?.name || mapping.teacherEmployeeId,
        subjectType: 'core',
      }));

      coreRows.sort((a, b) => {
        if (a.section === b.section) {
          return a.subjectCode.localeCompare(b.subjectCode);
        }
        return a.section.localeCompare(b.section);
      });

      const electiveRows: SubjectAssignmentRow[] = electiveDocs.map((offering: any) => ({
        subjectCode: offering.subjectCode,
        subjectName: offering.subjectName || offering.subjectCode,
        section: offering.section || '—',
        teacherEmployeeId: offering.teacherEmployeeId,
        teacherName: teacherMap.get(offering.teacherEmployeeId)?.name || offering.teacherEmployeeId,
        subjectType: 'open_elective',
      }));

      electiveRows.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));

      setCoreAssignments(coreRows);
      setOpenElectiveAssignments(electiveRows);

      if (coreRows.length === 0 && electiveRows.length === 0) {
        setAssignmentError('No teacher mappings found for the selected semester.');
      }
    } catch (error) {
      console.error('Error loading teacher assignments:', error);
      setAssignmentError('Unable to load teacher assignments. Please try again.');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleSaveClearanceAssignment = async () => {
    const departmentId = isSuperAdmin ? clearanceFilters.departmentId : user?.departmentId;
    if (!departmentId) {
      setClearanceAssignmentError('Please select a department.');
      return;
    }

    if (!selectedClearanceTeacher) {
      setClearanceAssignmentError('Please select a teacher to assign.');
      return;
    }

    try {
      setClearanceSubmitting(true);
      setClearanceAssignmentError(null);

      // Map clearance type to its typeId
      const clearanceTypeMap: Record<'sports' | 'certificate', string> = {
        sports: 'sports',
        certificate: 'certificate'
      };

      const clearanceTypeId = clearanceTypeMap[clearanceFilters.clearanceType];

      // Use adminService to update the mapping
      const { updateCommonClearanceMapping } = await import('@/services/adminService');
      await updateCommonClearanceMapping(clearanceTypeId, selectedClearanceTeacher, departmentId);

      toast({
        title: 'Assignment saved',
        description: `${clearanceFilters.clearanceType} teacher assigned successfully for ${departmentId} department.`,
      });

      setClearanceAssignmentDialogOpen(false);
      setSelectedClearanceTeacher('');
      // Reload the assignments to show the updated list
      await loadClearanceAssignments(departmentId);
    } catch (error) {
      console.error('Error saving clearance assignment:', error);
      setClearanceAssignmentError('Failed to save assignment. Please try again.');
      toast({
        title: 'Save failed',
        description: 'Could not save clearance assignment.',
        variant: 'destructive'
      });
    } finally {
      setClearanceSubmitting(false);
    }
  };

  const loadClearanceAssignments = async (departmentId: string) => {
    try {
      setClearanceAssignmentLoading(true);
      
      // Load sports assignment
      const sportDocId = `${departmentId}_sports`;
      const sportsRef = doc(db, 'common_clearance_mapping', sportDocId);
      const sportsSnap = await getDoc(sportsRef);
      
      // Load certificate assignment
      const certDocId = `${departmentId}_certificate`;
      const certRef = doc(db, 'common_clearance_mapping', certDocId);
      const certSnap = await getDoc(certRef);
      
      const assignments: typeof clearanceAssignments = [];
      
      if (sportsSnap.exists()) {
        const sportsData = sportsSnap.data() as any;
        try {
          const teacher = await getTeacher(sportsData.teacherEmployeeId);
          assignments.push({
            clearanceType: 'sports',
            departmentId,
            assignedTeacher: { employeeId: teacher.employeeId, name: teacher.name }
          });
        } catch (e) {
          assignments.push({
            clearanceType: 'sports',
            departmentId,
            assignedTeacher: { employeeId: sportsData.teacherEmployeeId, name: 'Unknown Teacher' }
          });
        }
      }
      
      if (certSnap.exists()) {
        const certData = certSnap.data() as any;
        try {
          const teacher = await getTeacher(certData.teacherEmployeeId);
          assignments.push({
            clearanceType: 'certificate',
            departmentId,
            assignedTeacher: { employeeId: teacher.employeeId, name: teacher.name }
          });
        } catch (e) {
          assignments.push({
            clearanceType: 'certificate',
            departmentId,
            assignedTeacher: { employeeId: certData.teacherEmployeeId, name: 'Unknown Teacher' }
          });
        }
      }
      
      setClearanceAssignments(assignments);
    } catch (error) {
      console.error('Error loading clearance assignments:', error);
    } finally {
      setClearanceAssignmentLoading(false);
    }
  };

  const getTeacher = async (employeeId: string) => {
    const teacherRef = doc(db, 'teachers', employeeId);
    const teacherSnap = await getDoc(teacherRef);
    if (!teacherSnap.exists()) {
      throw new Error('Teacher not found');
    }
    return teacherSnap.data() as any;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">U</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  UniFlow Admin
                </h1>
                <p className="text-sm text-muted-foreground">Department Administration</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <Card className="mb-8 shadow-lg border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome, {user.name || 'Admin'}</CardTitle>
            <CardDescription>
              {isSuperAdmin ? 'Super Administrator - All Departments' : `${user.departmentId || 'Your Department'} Department Administration`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Role</p>
                  <p className="text-lg font-semibold">{isSuperAdmin ? 'Super Admin' : 'Department Admin'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-indigo-50 rounded-lg">
                <Mail className="h-6 w-6 text-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm font-semibold truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                <Building2 className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Department</p>
                  <p className="text-lg font-semibold">{isSuperAdmin ? 'All' : user.departmentId || 'N/A'}</p>
                </div>
              </div>
            </div>
            {isDeptAdmin && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> As a department admin, you can only manage accounts and curriculum for the <strong>{user.departmentId}</strong> department.
                </p>
              </div>
            )}
            {isSuperAdmin && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Super Admin:</strong> You can create department admins and view all curriculum. Department admins manage their own curriculum.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Functions Grid */}
        {countsError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {countsError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Manage Students */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <GraduationCap className="h-10 w-10 text-green-600" />
                <span className="text-3xl font-bold text-green-600">
                  {countsLoading ? '...' : entityCounts.students.toLocaleString()}
                </span>
              </div>
              <CardTitle className="mt-4">Manage Students</CardTitle>
              <CardDescription>
                Add, edit, or remove student accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={() => setViewStudentsOpen(true)}>
                View Students
              </Button>
            </CardContent>
          </Card>

          {/* Manage Teachers */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Users className="h-10 w-10 text-blue-600" />
                <span className="text-3xl font-bold text-blue-600">
                  {countsLoading ? '...' : entityCounts.teachers.toLocaleString()}
                </span>
              </div>
              <CardTitle className="mt-4">Manage Teachers</CardTitle>
              <CardDescription>
                Add, edit, or remove teacher accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={() => setViewTeachersOpen(true)}>
                View Teachers
              </Button>
            </CardContent>
          </Card>

          {/* Generate Hall Tickets */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Shield className="h-10 w-10 text-orange-600" />
                <span className="text-3xl font-bold text-orange-600">
                  {hallTicketCandidates.length}
                </span>
              </div>
              <CardTitle className="mt-4">Hall Tickets</CardTitle>
              <CardDescription>
                Generate hall tickets after clearances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={() => {
                setHallTicketDialogOpen(true);
                loadHallTicketCandidates();
              }}>
                Generate Tickets
              </Button>
            </CardContent>
          </Card>

          {/* Department Settings */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-red-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Building2 className="h-10 w-10 text-red-600" />
              </div>
              <CardTitle className="mt-4">Department Settings</CardTitle>
              <CardDescription>
                Configure department-specific settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                View Settings
              </Button>
            </CardContent>
          </Card>

          {/* Reports */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-yellow-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <BookOpen className="h-10 w-10 text-yellow-600" />
              </div>
              <CardTitle className="mt-4">Reports</CardTitle>
              <CardDescription>
                View analytics and generate reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                View Reports
              </Button>
            </CardContent>
          </Card>

          {/* Teacher Assignment Viewer */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <ClipboardList className="h-10 w-10 text-purple-600" />
              </div>
              <CardTitle className="mt-4">Teacher Assignments</CardTitle>
              <CardDescription>
                See subject-wise faculty and open electives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={() => setAssignmentDialogOpen(true)}>
                View Assignments
              </Button>
            </CardContent>
          </Card>

          {/* Clearance Assignments (Sports & Certificate) */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-rose-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Users className="h-10 w-10 text-rose-600" />
              </div>
              <CardTitle className="mt-4">Clearance Assignments</CardTitle>
              <CardDescription>
                Assign sports and certificate teachers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={() => setClearanceAssignmentDialogOpen(true)}>
                Manage Assignments
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-indigo-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <BookOpen className="h-10 w-10 text-indigo-600" />
              </div>
              <CardTitle className="mt-4">Curriculum Catalog</CardTitle>
              <CardDescription>
                View and edit curriculum subjects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setCurriculumListOpen(true);
                  loadCurriculumList();
                }}
              >
                View Curriculum
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
          <strong>Heads-up:</strong> No Due clearances are actioned by faculty, librarian, accounts, sports, and other clearance owners inside their own dashboards. Department admins focus on provisioning accounts and curriculum setup here.
        </div>

        <Dialog open={viewStudentsOpen} onOpenChange={setViewStudentsOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Students ({entityCounts.students.toLocaleString()})</DialogTitle>
              <DialogDescription>
                {isSuperAdmin ? 'All departments' : `${user.departmentId} Department`} • Sorted by USN
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pb-4">
              {academicContextError && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {academicContextError}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Filter by name"
                  value={studentFilters.name}
                  onChange={(e) => setStudentFilters((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full md:w-[180px]"
                />
                <Input
                  placeholder="Filter by USN"
                  value={studentFilters.usn}
                  onChange={(e) => setStudentFilters((prev) => ({ ...prev, usn: e.target.value.toUpperCase() }))}
                  className="w-full md:w-[160px]"
                />
                <Select
                  value={studentFilters.semester}
                  onValueChange={(value) => setStudentFilters((prev) => ({ ...prev, semester: value }))}
                >
                  <SelectTrigger className="w-full md:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Semesters</SelectItem>
                    {SEMESTER_OPTIONS.map((sem) => (
                      <SelectItem key={sem} value={String(sem)}>
                        Semester {sem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={studentFilters.section}
                  onValueChange={(value) => setStudentFilters((prev) => ({ ...prev, section: value }))}
                >
                  <SelectTrigger className="w-full md:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {SECTION_OPTIONS.map((section) => (
                      <SelectItem key={section} value={section}>
                        Section {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                {listError && (
                  <div className="text-xs text-red-600 self-center">{listError}</div>
                )}
                <Button size="sm" variant="outline" onClick={loadStudents} disabled={listLoading.students}>
                  {listLoading.students ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[60vh] border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="px-4 py-3">USN</th>
                    <th className="px-4 py-3">Name</th>
                    {isSuperAdmin && <th className="px-4 py-3">Department</th>}
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Sem</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Mentor</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading.students ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-6 text-center text-muted-foreground">
                        Loading students...
                      </td>
                    </tr>
                  ) : filteredStudentList.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-6 text-center text-muted-foreground">
                        No students match the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentList.map((student) => (
                      <tr
                        key={student.id}
                        className="border-t hover:bg-blue-50/50 cursor-pointer"
                        onClick={() => {
                          setSelectedStudent(student);
                          setStudentDetailOpen(true);
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-xs uppercase">{student.usn}</td>
                        <td className="px-4 py-3 text-blue-700 hover:underline">{student.name}</td>
                        {isSuperAdmin && <td className="px-4 py-3">{student.departmentId}</td>}
                        <td className="px-4 py-3">{student.batchYear}</td>
                        <td className="px-4 py-3">{student.currentSemester ?? '—'}</td>
                        <td className="px-4 py-3">{student.section}</td>
                        <td className="px-4 py-3">{student.mentorEmployeeId || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={viewTeachersOpen} onOpenChange={setViewTeachersOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Teachers ({entityCounts.teachers.toLocaleString()})</DialogTitle>
              <DialogDescription>
                {isSuperAdmin ? 'All departments' : `${user.departmentId} Department`} • Sorted by Employee ID
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-3 pb-4">
              <Input
                placeholder="Filter by name"
                value={teacherFilters.name}
                onChange={(e) => setTeacherFilters((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full md:w-[200px]"
              />
              <Input
                placeholder="Filter by Faculty ID"
                value={teacherFilters.employeeId}
                onChange={(e) => setTeacherFilters((prev) => ({ ...prev, employeeId: e.target.value.toUpperCase() }))}
                className="w-full md:w-[200px]"
              />
              <div className="flex-1" />
              {listError && (
                <div className="text-xs text-red-600 self-center">{listError}</div>
              )}
              <Button size="sm" variant="outline" onClick={loadTeachers} disabled={listLoading.teachers}>
                {listLoading.teachers ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Designation</th>
                    <th className="px-4 py-3">Role</th>
                    {isSuperAdmin && <th className="px-4 py-3">Department</th>}
                    <th className="px-4 py-3">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading.teachers ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-6 text-center text-muted-foreground">
                        Loading teachers...
                      </td>
                    </tr>
                  ) : filteredTeacherList.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-6 text-center text-muted-foreground">
                        No teachers match the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTeacherList.map((teacher) => (
                      <tr
                        key={teacher.id}
                        className="border-t hover:bg-blue-50/50 cursor-pointer"
                        onClick={() => {
                          setSelectedTeacher(teacher);
                          setTeacherDetailOpen(true);
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-xs uppercase">{teacher.employeeId}</td>
                        <td className="px-4 py-3 text-blue-700 hover:underline">{teacher.name}</td>
                        <td className="px-4 py-3">{teacher.designation || '-'}</td>
                        <td className="px-4 py-3 capitalize">{teacher.role}</td>
                        {isSuperAdmin && <td className="px-4 py-3">{teacher.departmentId}</td>}
                        <td className="px-4 py-3 truncate max-w-[180px]">{teacher.email}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={hallTicketDialogOpen} onOpenChange={setHallTicketDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Hall Ticket Generation</DialogTitle>
              <DialogDescription>Generate hall tickets for mentor-approved students.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-3 pb-4">
              {isSuperAdmin ? (
                <Select value={hallTicketDepartment} onValueChange={setHallTicketDepartment}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter((dept) => dept !== 'ALL').map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={user?.departmentId || 'N/A'} disabled className="w-full md:w-[200px] bg-gray-100" />
              )}
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setExamDateDialogOpen(true);
                  loadExamDates();
                }}
              >
                Edit Exam Dates
              </Button>
              <Button size="sm" variant="outline" onClick={loadHallTicketCandidates} disabled={hallTicketLoading}>
                {hallTicketLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="px-4 py-3">USN</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Semester</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Mentor Approved</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hallTicketLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        Loading candidates...
                      </td>
                    </tr>
                  ) : hallTicketCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        No mentor-approved students waiting for hall tickets.
                      </td>
                    </tr>
                  ) : (
                    hallTicketCandidates.map((candidate) => (
                      <tr key={candidate.usn} className="border-t">
                        <td className="px-4 py-3 font-mono text-xs uppercase">{candidate.usn}</td>
                        <td className="px-4 py-3 font-medium">{candidate.studentName}</td>
                        <td className="px-4 py-3">{candidate.semesterNumber}</td>
                        <td className="px-4 py-3">{candidate.section}</td>
                        <td className="px-4 py-3 text-xs">
                          {candidate.mentorApprovedAt ? candidate.mentorApprovedAt.toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" onClick={() => handleGenerateHallTicket(candidate.usn)}>
                            Generate PDF
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={examDateDialogOpen} onOpenChange={setExamDateDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Exam Schedule</DialogTitle>
              <DialogDescription>Set exam dates per subject. Leave blank if not scheduled.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-3 pb-4">
              {isSuperAdmin ? (
                <Select value={hallTicketDepartment} onValueChange={setHallTicketDepartment}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter((dept) => dept !== 'ALL').map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={user?.departmentId || 'N/A'} disabled className="w-full md:w-[200px] bg-gray-100" />
              )}
              <Select value={examDateSemester} onValueChange={setExamDateSemester}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTER_OPTIONS.map((sem) => (
                    <SelectItem key={sem} value={String(sem)}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={loadExamDates} disabled={examDateLoading}>
                {examDateLoading ? 'Loading...' : 'Load'}
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Subject Code</th>
                    <th className="px-4 py-3">Subject Name</th>
                    <th className="px-4 py-3">Exam Date (optional)</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {examDateLoading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        Loading exam dates...
                      </td>
                    </tr>
                  ) : examDateRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No subjects found for this semester.
                      </td>
                    </tr>
                  ) : (
                    examDateRows.map((row, index) => (
                      <tr key={row.subjectCode} className="border-t">
                        <td className="px-4 py-3 font-mono text-xs uppercase">{row.subjectCode}</td>
                        <td className="px-4 py-3 font-medium">{row.subjectName}</td>
                        <td className="px-4 py-3">
                          <Input
                            type="date"
                            value={row.examDate || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setExamDateRows((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], examDate: value };
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => {
                              setExamDateRows((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], examDate: '' };
                                return next;
                              });
                            }}
                          >
                            Clear
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setExamDateDialogOpen(false)} disabled={examDateLoading}>
                Cancel
              </Button>
              <Button onClick={handleSaveExamDates} disabled={examDateLoading}>
                {examDateLoading ? 'Saving...' : 'Save Dates'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clearance Assignment Dialog */}
        <Dialog 
          open={clearanceAssignmentDialogOpen} 
          onOpenChange={(open) => {
            console.log('[AdminDashboard] Clearance dialog onOpenChange:', { open, teacherListLength: teacherList.length });
            setClearanceAssignmentDialogOpen(open);
            if (open) {
              if (teacherList.length === 0) {
                console.log('[AdminDashboard] Loading teachers for clearance dialog');
                loadTeachers();
              }
              // Load current assignments
              const deptId = isSuperAdmin ? clearanceFilters.departmentId : user?.departmentId;
              if (deptId) {
                loadClearanceAssignments(deptId);
              }
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Clearance Assignments</DialogTitle>
              <DialogDescription>
                Assign sports and certificate teachers per department for no-due clearances.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  {isSuperAdmin ? (
                    <Select
                      value={clearanceFilters.departmentId}
                      onValueChange={(value) => setClearanceFilters((prev) => ({ ...prev, departmentId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments
                          .filter((dept) => dept !== 'ALL')
                          .map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={user?.departmentId || 'N/A'} disabled className="bg-gray-100" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Clearance Type</Label>
                  <Select
                    value={clearanceFilters.clearanceType}
                    onValueChange={(value) => setClearanceFilters((prev) => ({ ...prev, clearanceType: value as 'sports' | 'certificate' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="certificate">Certificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assigned Teacher</Label>
                <Select value={selectedClearanceTeacher} onValueChange={setSelectedClearanceTeacher}>
                  <SelectTrigger>
                    <SelectValue placeholder={teacherList.length === 0 ? 'Loading teachers...' : 'Select a teacher'} />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherList.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-muted-foreground">No teachers available</div>
                    ) : (
                      teacherList.map((teacher) => (
                        <SelectItem key={teacher.employeeId} value={teacher.employeeId}>
                          {teacher.name} ({teacher.employeeId})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {clearanceFilters.clearanceType === 'sports' && 'Sports teacher will review all sports clearance requests from this department'}
                  {clearanceFilters.clearanceType === 'certificate' && 'Certificate coordinator will review all certificate requests from this department'}
                </p>
              </div>

              {clearanceAssignmentError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {clearanceAssignmentError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setClearanceAssignmentDialogOpen(false)} disabled={clearanceSubmitting}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveClearanceAssignment} 
                  disabled={clearanceSubmitting || !selectedClearanceTeacher}
                >
                  {clearanceSubmitting ? 'Saving...' : 'Save Assignment'}
                </Button>
              </div>

              {/* Current Assignments Section */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold text-sm mb-3">Current Assignments for {clearanceFilters.departmentId || (user?.departmentId || 'Department')}</h4>
                {clearanceAssignmentLoading ? (
                  <div className="text-sm text-muted-foreground">Loading assignments...</div>
                ) : clearanceAssignments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No assignments set yet</div>
                ) : (
                  <div className="space-y-2">
                    {clearanceAssignments.map((assignment) => (
                      <div key={assignment.clearanceType} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium capitalize text-sm">{assignment.clearanceType}</p>
                          <p className="text-xs text-muted-foreground">
                            {assignment.assignedTeacher?.name} ({assignment.assignedTeacher?.employeeId})
                          </p>
                        </div>
                        <div className="text-xs text-green-600 font-medium">✓ Assigned</div>
                      </div>
                    ))}
                    {clearanceAssignments.length === 1 && (
                      <div className="text-xs text-muted-foreground p-3 bg-gray-50 rounded-lg">
                        {clearanceAssignments[0].clearanceType === 'sports' 
                          ? 'Certificate coordinator not assigned yet' 
                          : 'Sports coordinator not assigned yet'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={curriculumListOpen}
          onOpenChange={(open) => {
            setCurriculumListOpen(open);
            if (!open) {
              setCurriculumList([]);
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Curriculum Catalog</DialogTitle>
              <DialogDescription>View and update subjects in the curriculum.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-3 pb-4">
              {isSuperAdmin ? (
                <Select
                  value={curriculumFilters.departmentId}
                  onValueChange={(value) => setCurriculumFilters((prev) => ({ ...prev, departmentId: value }))}
                >
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter((dept) => dept !== 'ALL').map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={user?.departmentId || 'N/A'} disabled className="w-full md:w-[200px] bg-gray-100" />
              )}
              <Input
                placeholder="Batch year"
                value={curriculumFilters.batchYear}
                onChange={(e) => setCurriculumFilters((prev) => ({ ...prev, batchYear: e.target.value }))}
                className="w-full md:w-[140px]"
              />
              <Select
                value={curriculumFilters.semesterNumber}
                onValueChange={(value) => setCurriculumFilters((prev) => ({ ...prev, semesterNumber: value }))}
              >
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {SEMESTER_OPTIONS.map((sem) => (
                    <SelectItem key={sem} value={String(sem)}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Subject code"
                value={curriculumFilters.subjectCode}
                onChange={(e) => setCurriculumFilters((prev) => ({ ...prev, subjectCode: e.target.value }))}
                className="w-full md:w-[180px]"
              />
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={loadCurriculumList} disabled={curriculumLoading}>
                {curriculumLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Semester</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {curriculumLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                        Loading curriculum...
                      </td>
                    </tr>
                  ) : curriculumList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                        No curriculum entries found.
                      </td>
                    </tr>
                  ) : (
                    curriculumList.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3 font-mono text-xs uppercase">{item.subjectCode}</td>
                        <td className="px-4 py-3 font-medium">{item.subjectName}</td>
                        <td className="px-4 py-3 capitalize">{item.subjectType}</td>
                        <td className="px-4 py-3">{item.departmentId}</td>
                        <td className="px-4 py-3">{item.batchYear}</td>
                        <td className="px-4 py-3">{item.semesterNumber}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCurriculumEditForm({
                                docId: item.id,
                                subjectName: item.subjectName || '',
                                subjectType: item.subjectType || 'core',
                              });
                              setCurriculumEditOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={assignmentDialogOpen}
          onOpenChange={(open) => {
            setAssignmentDialogOpen(open);
            if (!open) {
              setAssignmentError(null);
              setCoreAssignments([]);
              setOpenElectiveAssignments([]);
              setAssignmentsFetched(false);
              setAssignmentLoading(false);
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Teacher Assignments</DialogTitle>
              <DialogDescription>
                Subject-to-faculty map for the selected batch, semester, and department.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Department</Label>
                  {isSuperAdmin ? (
                    <Select
                      value={assignmentFilters.departmentId}
                      onValueChange={(value) => setAssignmentFilters((prev) => ({ ...prev, departmentId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments
                          .filter((dept) => dept !== 'ALL')
                          .map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={user?.departmentId || 'N/A'} disabled className="bg-gray-100" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Batch Year</Label>
                  <Input
                    type="number"
                    value={assignmentFilters.batchYear}
                    onChange={(e) => setAssignmentFilters((prev) => ({ ...prev, batchYear: e.target.value }))}
                    placeholder="2022"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select
                    value={assignmentFilters.semesterNumber}
                    onValueChange={(value) => setAssignmentFilters((prev) => ({ ...prev, semesterNumber: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMESTER_OPTIONS.map((sem) => (
                        <SelectItem key={sem} value={String(sem)}>
                          Semester {sem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={loadTeacherAssignments} disabled={assignmentLoading}>
                  {assignmentLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load assignments'
                  )}
                </Button>
                {assignmentError && !assignmentLoading && (
                  <span className="text-sm text-red-600">{assignmentError}</span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground">Core Subjects</h4>
                  {assignmentLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Fetching mappings...</div>
                  ) : coreAssignments.length === 0 ? (
                    <div className="py-4 text-sm text-muted-foreground">
                      {assignmentsFetched ? 'No core subject assignments found.' : 'Load assignments to view current mappings.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          <tr>
                            <th className="px-4 py-3">Subject Name</th>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Section</th>
                            <th className="px-4 py-3">Teacher</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coreAssignments.map((row) => (
                            <tr key={`${row.subjectCode}_${row.section}`} className="border-t">
                              <td className="px-4 py-3 font-medium">{row.subjectName}</td>
                              <td className="px-4 py-3 font-mono text-xs uppercase">{row.subjectCode}</td>
                              <td className="px-4 py-3">{row.section}</td>
                              <td className="px-4 py-3">
                                <span className="font-medium">{row.teacherName}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{row.teacherEmployeeId}</span>
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setMappingEditForm({
                                      departmentId: assignmentFilters.departmentId || user?.departmentId || '',
                                      batchYear: assignmentFilters.batchYear,
                                      semesterNumber: assignmentFilters.semesterNumber,
                                      section: row.section,
                                      subjectCode: row.subjectCode,
                                      teacherEmployeeId: row.teacherEmployeeId,
                                    });
                                    setMappingEditOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-2 text-red-600 hover:text-red-700"
                                  onClick={() => handleDeleteCoreMapping(row)}
                                >
                                  Delete
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground">Open Electives</h4>
                  {assignmentLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Fetching offerings...</div>
                  ) : openElectiveAssignments.length === 0 ? (
                    <div className="py-4 text-sm text-muted-foreground">
                      {assignmentsFetched ? 'No open elective offerings configured for this semester.' : 'Load assignments to view open elective faculty.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          <tr>
                            <th className="px-4 py-3">Subject Name</th>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Section</th>
                            <th className="px-4 py-3">Teacher</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openElectiveAssignments.map((row) => (
                            <tr key={row.subjectCode} className="border-t">
                              <td className="px-4 py-3 font-medium">{row.subjectName}</td>
                              <td className="px-4 py-3 font-mono text-xs uppercase">{row.subjectCode}</td>
                              <td className="px-4 py-3">{row.section || '—'}</td>
                              <td className="px-4 py-3">
                                <span className="font-medium">{row.teacherName}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{row.teacherEmployeeId}</span>
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setOpenElectiveEditForm({
                                      departmentId: assignmentFilters.departmentId || user?.departmentId || '',
                                      batchYear: assignmentFilters.batchYear,
                                      semesterNumber: assignmentFilters.semesterNumber,
                                      subjectCode: row.subjectCode,
                                      section: row.section || '',
                                      subjectName: row.subjectName,
                                      teacherEmployeeId: row.teacherEmployeeId,
                                    });
                                    setOpenElectiveEditOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-2 text-red-600 hover:text-red-700"
                                  onClick={() => handleDeleteOpenElectiveOffering(row)}
                                >
                                  Delete
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={curriculumEditOpen} onOpenChange={setCurriculumEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Curriculum Subject</DialogTitle>
              <DialogDescription>Update the subject name or type.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Subject Name</Label>
                <Input
                  value={curriculumEditForm.subjectName}
                  onChange={(e) => setCurriculumEditForm((prev) => ({ ...prev, subjectName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Subject Type</Label>
                <Select
                  value={curriculumEditForm.subjectType}
                  onValueChange={(value) => setCurriculumEditForm((prev) => ({ ...prev, subjectType: value as typeof curriculumEditForm.subjectType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="core">core</SelectItem>
                    <SelectItem value="open_elective">open_elective</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurriculumEditOpen(false)} disabled={curriculumSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveCurriculum} disabled={curriculumSaving}>
                {curriculumSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={mappingEditOpen} onOpenChange={setMappingEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Core Subject Mapping</DialogTitle>
              <DialogDescription>Update the assigned teacher for this subject.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Subject Code</p>
                  <p className="font-medium">{mappingEditForm.subjectCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Section</p>
                  <p className="font-medium">{mappingEditForm.section}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Teacher Employee ID</Label>
                <Input
                  value={mappingEditForm.teacherEmployeeId}
                  onChange={(e) => setMappingEditForm((prev) => ({ ...prev, teacherEmployeeId: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMappingEditOpen(false)} disabled={mappingSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveMapping} disabled={mappingSaving}>
                {mappingSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={openElectiveEditOpen} onOpenChange={setOpenElectiveEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Open Elective Offering</DialogTitle>
              <DialogDescription>Update subject name or assigned teacher.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Subject Name</Label>
                <Input
                  value={openElectiveEditForm.subjectName}
                  onChange={(e) => setOpenElectiveEditForm((prev) => ({ ...prev, subjectName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Input
                  value={openElectiveEditForm.section}
                  onChange={(e) => setOpenElectiveEditForm((prev) => ({ ...prev, section: e.target.value }))}
                  placeholder="A / B / ALL"
                />
              </div>
              <div className="space-y-2">
                <Label>Teacher Employee ID</Label>
                <Input
                  value={openElectiveEditForm.teacherEmployeeId}
                  onChange={(e) => setOpenElectiveEditForm((prev) => ({ ...prev, teacherEmployeeId: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenElectiveEditOpen(false)} disabled={openElectiveSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveOpenElectiveOffering} disabled={openElectiveSaving}>
                {openElectiveSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={studentDetailOpen} onOpenChange={(open) => {
          setStudentDetailOpen(open);
          if (!open) {
            setSelectedStudent(null);
            setStudentEditMode(false);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedStudent?.name || 'Student Details'}</DialogTitle>
              <DialogDescription>
                {selectedStudent?.usn}
              </DialogDescription>
            </DialogHeader>
            {selectedStudent ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Edit student details</p>
                  <div className="flex gap-2">
                    {studentEditMode ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setStudentEditMode(false)} disabled={studentSaving}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveStudent} disabled={studentSaving}>
                          {studentSaving ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setStudentEditMode(true)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleDeleteStudent}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    {studentEditMode ? (
                      <Input
                        value={studentEditForm.email}
                        onChange={(e) => setStudentEditForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    ) : (
                      <p className="font-medium break-all">{selectedStudent.email || 'Not provided'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mentor ID</p>
                    {studentEditMode ? (
                      <Input
                        value={studentEditForm.mentorEmployeeId}
                        onChange={(e) => setStudentEditForm((prev) => ({ ...prev, mentorEmployeeId: e.target.value }))}
                      />
                    ) : (
                      <p className="font-medium">{selectedStudent.mentorEmployeeId || 'Not assigned'}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    {studentEditMode ? (
                      <Input
                        value={studentEditForm.dateOfBirth}
                        onChange={(e) => setStudentEditForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                        placeholder="YYYY-MM-DD"
                      />
                    ) : (
                      <p className="font-medium">{selectedStudent.dateOfBirth || '—'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Semester</p>
                    <p className="font-medium">{selectedStudent.currentSemester ?? '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Batch Year</p>
                    {studentEditMode ? (
                      <Input
                        type="number"
                        value={studentEditForm.batchYear}
                        onChange={(e) => setStudentEditForm((prev) => ({ ...prev, batchYear: e.target.value }))}
                      />
                    ) : (
                      <p className="font-medium">{selectedStudent.batchYear}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Section</p>
                    {studentEditMode ? (
                      <Select
                        value={studentEditForm.section}
                        onValueChange={(value) => setStudentEditForm((prev) => ({ ...prev, section: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTION_OPTIONS.map((section) => (
                            <SelectItem key={section} value={section}>
                              Section {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{selectedStudent.section}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    {studentEditMode ? (
                      isSuperAdmin ? (
                        <Select
                          value={studentEditForm.departmentId}
                          onValueChange={(value) => setStudentEditForm((prev) => ({ ...prev, departmentId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.filter((dept) => dept !== 'ALL').map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={studentEditForm.departmentId} disabled className="bg-gray-100" />
                      )
                    ) : (
                      <p className="font-medium">{selectedStudent.departmentId}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{selectedStudent.status || 'active'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a student to view details.</p>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={teacherDetailOpen} onOpenChange={(open) => {
          setTeacherDetailOpen(open);
          if (!open) {
            setSelectedTeacher(null);
            setTeacherEditMode(false);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedTeacher?.name || 'Teacher Details'}</DialogTitle>
              <DialogDescription>
                {selectedTeacher?.employeeId}
              </DialogDescription>
            </DialogHeader>
            {selectedTeacher ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Edit teacher details</p>
                  <div className="flex gap-2">
                    {teacherEditMode ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setTeacherEditMode(false)} disabled={teacherSaving}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveTeacher} disabled={teacherSaving}>
                          {teacherSaving ? 'Saving...' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setTeacherEditMode(true)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleDeleteTeacher}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    {teacherEditMode ? (
                      <Input
                        value={teacherEditForm.name}
                        onChange={(e) => setTeacherEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    ) : (
                      <p className="font-medium">{selectedTeacher.name}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Designation</p>
                    {teacherEditMode ? (
                      <Input
                        value={teacherEditForm.designation}
                        onChange={(e) => setTeacherEditForm((prev) => ({ ...prev, designation: e.target.value }))}
                      />
                    ) : (
                      <p className="font-medium">{selectedTeacher.designation || '—'}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    {teacherEditMode ? (
                      <Input
                        value={teacherEditForm.email}
                        onChange={(e) => setTeacherEditForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    ) : (
                      <p className="font-medium break-all">{selectedTeacher.email}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    {teacherEditMode ? (
                      <Select
                        value={teacherEditForm.role}
                        onValueChange={(value) => setTeacherEditForm((prev) => ({ ...prev, role: value as typeof teacherEditForm.role }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['faculty', 'librarian', 'accounts', 'sports', 'admin'].map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium capitalize">{selectedTeacher.role}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    {teacherEditMode ? (
                      isSuperAdmin ? (
                        <Select
                          value={teacherEditForm.departmentId}
                          onValueChange={(value) => setTeacherEditForm((prev) => ({ ...prev, departmentId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.filter((dept) => dept !== 'ALL').map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={teacherEditForm.departmentId} disabled className="bg-gray-100" />
                      )
                    ) : (
                      <p className="font-medium">{selectedTeacher.departmentId}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Employee ID</p>
                    <p className="font-medium">{selectedTeacher.employeeId}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a teacher to view details.</p>
            )}
          </DialogContent>
        </Dialog>

        {/* Quick Actions */}
        <Card className="mt-8 shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Student Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Student Account</DialogTitle>
                    <DialogDescription>
                      Create a new student account with USN and date of birth
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="usn">USN *</Label>
                        <Input
                          id="usn"
                          placeholder="e.g., 1BM21CS001"
                          value={studentForm.usn}
                          onChange={(e) => setStudentForm({...studentForm, usn: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="student-name">Full Name *</Label>
                        <Input
                          id="student-name"
                          placeholder="e.g., John Doe"
                          value={studentForm.name}
                          onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-email">Email (optional)</Label>
                      <Input
                        id="student-email"
                        type="email"
                        placeholder="e.g., student@bnmit.in"
                        value={studentForm.email}
                        onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">If left blank, an email will be auto-generated from the USN.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth *</Label>
                        <Input
                          id="dob"
                          type="date"
                          value={studentForm.dateOfBirth}
                          onChange={(e) => setStudentForm({...studentForm, dateOfBirth: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dept">Department *</Label>
                        {isDeptAdmin ? (
                          <Input
                            id="dept"
                            value={user?.departmentId || 'CSE'}
                            disabled
                            className="bg-gray-100"
                          />
                        ) : (
                          <Select value={studentForm.departmentId} onValueChange={(value) => setStudentForm({...studentForm, departmentId: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="batch">Batch Year *</Label>
                        <Input
                          id="batch"
                          type="number"
                          placeholder="e.g., 2021"
                          value={studentForm.batchYear}
                          onChange={(e) => setStudentForm({...studentForm, batchYear: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="section">Section *</Label>
                        <Select value={studentForm.section} onValueChange={(value) => setStudentForm({...studentForm, section: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                            <SelectItem value="D">D</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mentor">Mentor ID</Label>
                        <Input
                          id="mentor"
                          placeholder="e.g., FAC001"
                          value={studentForm.mentorEmployeeId}
                          onChange={(e) => setStudentForm({...studentForm, mentorEmployeeId: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setStudentDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddStudent} disabled={loading}>
                      {loading ? 'Creating...' : 'Create Student'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {isSuperAdmin && (
                <Dialog open={contextDialogOpen} onOpenChange={setContextDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary">
                      <Shield className="mr-2 h-4 w-4" />
                      Update Academic Context
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Update Academic Context</DialogTitle>
                      <DialogDescription>
                        Set the active academic year and whether the current semester is odd or even.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="academic-year">Academic Year</Label>
                        <Input
                          id="academic-year"
                          placeholder="e.g., 2025-26"
                          value={contextForm.academicYear}
                          onChange={(e) => setContextForm((prev) => ({ ...prev, academicYear: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">Used for semester calculations across the portal.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Semester Type</Label>
                        <Select
                          value={contextForm.semesterType}
                          onValueChange={(value) => setContextForm((prev) => ({ ...prev, semesterType: value as 'odd' | 'even' }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="odd">Odd Semester</SelectItem>
                            <SelectItem value="even">Even Semester</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Changing the academic context updates semester calculations for every student.
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setContextDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateAcademicContext} disabled={contextUpdating}>
                        {contextUpdating ? 'Updating...' : 'Save Context'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Teacher Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Teacher Account</DialogTitle>
                    <DialogDescription>
                      Create a new teacher account with email and temporary password
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="emp-id">Employee ID *</Label>
                        <Input
                          id="emp-id"
                          placeholder="e.g., FAC001"
                          value={teacherForm.employeeId}
                          onChange={(e) => setTeacherForm({...teacherForm, employeeId: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teacher-name">Full Name *</Label>
                        <Input
                          id="teacher-name"
                          placeholder="e.g., Dr. Jane Smith"
                          value={teacherForm.name}
                          onChange={(e) => setTeacherForm({...teacherForm, name: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="teacher-email">Email *</Label>
                        <Input
                          id="teacher-email"
                          type="email"
                          placeholder="e.g., jane@bnmit.in"
                          value={teacherForm.email}
                          onChange={(e) => setTeacherForm({...teacherForm, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teacher-dept">Department *</Label>
                        {isDeptAdmin ? (
                          <Input
                            id="teacher-dept"
                            value={user?.departmentId || 'CSE'}
                            disabled
                            className="bg-gray-100"
                          />
                        ) : (
                          <Select value={teacherForm.departmentId} onValueChange={(value) => setTeacherForm({...teacherForm, departmentId: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="teacher-designation">Designation *</Label>
                        <Input
                          id="teacher-designation"
                          placeholder="e.g., Assistant Professor"
                          value={teacherForm.designation}
                          onChange={(e) => setTeacherForm({...teacherForm, designation: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teacher-role">Role *</Label>
                        <Select value={teacherForm.role} onValueChange={(value: any) => setTeacherForm({...teacherForm, role: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="faculty">Faculty</SelectItem>
                            <SelectItem value="librarian">Librarian</SelectItem>
                            <SelectItem value="accounts">Accounts</SelectItem>
                            <SelectItem value="sports">Sports</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="temp-pass">Temporary Password *</Label>
                        <Input
                          id="temp-pass"
                          type="text"
                          placeholder="e.g., Welcome@123"
                          value={teacherForm.temporaryPassword}
                          onChange={(e) => setTeacherForm({...teacherForm, temporaryPassword: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setTeacherDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddTeacher} disabled={loading}>
                      {loading ? 'Creating...' : 'Create Teacher'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {isSuperAdmin && (
                <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Admin Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Department Admin</DialogTitle>
                      <DialogDescription>
                        Create a new department admin account
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin-id">Admin ID *</Label>
                          <Input
                            id="admin-id"
                            placeholder="e.g., ADMIN002"
                            value={adminForm.adminId}
                            onChange={(e) => setAdminForm({...adminForm, adminId: e.target.value.toUpperCase()})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-name">Full Name *</Label>
                          <Input
                            id="admin-name"
                            placeholder="e.g., Admin Name"
                            value={adminForm.name}
                            onChange={(e) => setAdminForm({...adminForm, name: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin-email">Email *</Label>
                          <Input
                            id="admin-email"
                            type="email"
                            placeholder="e.g., admin2@bnmit.in"
                            value={adminForm.email}
                            onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-dept">Department *</Label>
                          <Select value={adminForm.departmentId} onValueChange={(value) => setAdminForm({...adminForm, departmentId: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-pass">Temporary Password *</Label>
                        <Input
                          id="admin-pass"
                          type="text"
                          placeholder="e.g., Admin@123"
                          value={adminForm.temporaryPassword}
                          onChange={(e) => setAdminForm({...adminForm, temporaryPassword: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddAdmin} disabled={loading}>
                        {loading ? 'Creating...' : 'Create Admin'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {isDeptAdmin && (
                <>
                  <Dialog open={curriculumDialogOpen} onOpenChange={setCurriculumDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="default">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Subject/Curriculum
                      </Button>
                    </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Subject to Curriculum</DialogTitle>
                    <DialogDescription>
                      Add a subject to the curriculum for a specific batch and semester
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900">Department: {user?.departmentId}</p>
                      <p className="text-xs text-blue-700 mt-1">Subjects will be added to your department's curriculum</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="curr-batch">Batch Year *</Label>
                        <Input
                          id="curr-batch"
                          type="number"
                          placeholder="e.g., 2021"
                          value={curriculumForm.batchYear}
                          onChange={(e) => setCurriculumForm({...curriculumForm, batchYear: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="curr-sem">Semester *</Label>
                        <Select 
                          value={curriculumForm.semesterNumber.toString()} 
                          onValueChange={(value) => setCurriculumForm({...curriculumForm, semesterNumber: parseInt(value)})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5,6,7,8].map(sem => (
                              <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="subject-code">Subject Code *</Label>
                        <Input
                          id="subject-code"
                          placeholder="e.g., CS501"
                          value={curriculumForm.subjectCode}
                          onChange={(e) => setCurriculumForm({...curriculumForm, subjectCode: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject-name">Subject Name *</Label>
                        <Input
                          id="subject-name"
                          placeholder="e.g., Data Structures"
                          value={curriculumForm.subjectName}
                          onChange={(e) => setCurriculumForm({...curriculumForm, subjectName: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject-type">Subject Type *</Label>
                      <Select 
                        value={curriculumForm.subjectType} 
                        onValueChange={(value: any) => setCurriculumForm({...curriculumForm, subjectType: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="core">Core Subject</SelectItem>
                          <SelectItem value="open_elective">Open Elective</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                      <p><strong>Document ID:</strong> {curriculumForm.departmentId}_{curriculumForm.batchYear}_{curriculumForm.semesterNumber}_{curriculumForm.subjectCode || '___'}</p>
                      <p className="mt-1 text-xs text-blue-600">This subject will be available for batch {curriculumForm.batchYear} students in semester {curriculumForm.semesterNumber}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCurriculumDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddCurriculum} disabled={loading}>
                      {loading ? 'Adding...' : 'Add Subject'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={teacherMappingDialogOpen} onOpenChange={setTeacherMappingDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <Users className="mr-2 h-4 w-4" />
                    Assign Teacher to Subject
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Assign Teacher to Subject</DialogTitle>
                    <DialogDescription>
                      Map teachers to subjects for specific batch, semester, and section
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900">Department: {user?.departmentId}</p>
                      <p className="text-xs text-blue-700 mt-1">You can only assign teachers for your department</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="map-batch">Batch Year *</Label>
                        <Input
                          id="map-batch"
                          type="number"
                          placeholder="e.g., 2021"
                          value={teacherMappingForm.batchYear}
                          onChange={(e) => setTeacherMappingForm({...teacherMappingForm, batchYear: parseInt(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="map-sem">Semester *</Label>
                        <Select 
                          value={teacherMappingForm.semesterNumber.toString()} 
                          onValueChange={(value) => setTeacherMappingForm({...teacherMappingForm, semesterNumber: parseInt(value)})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5,6,7,8].map(sem => (
                              <SelectItem key={sem} value={sem.toString()}>Sem {sem}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="map-section">Section *</Label>
                        <Select 
                          value={teacherMappingForm.section} 
                          onValueChange={(value) => setTeacherMappingForm({...teacherMappingForm, section: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">Section A</SelectItem>
                            <SelectItem value="B">Section B</SelectItem>
                            <SelectItem value="C">Section C</SelectItem>
                            <SelectItem value="D">Section D</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="map-subject">Subject Code *</Label>
                        <Input
                          id="map-subject"
                          placeholder="e.g., CS501"
                          value={teacherMappingForm.subjectCode}
                          onChange={(e) => setTeacherMappingForm({...teacherMappingForm, subjectCode: e.target.value.toUpperCase()})}
                        />
                        <p className="text-xs text-muted-foreground">Subject must exist in curriculum first</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="map-teacher">Teacher Employee ID *</Label>
                        <Input
                          id="map-teacher"
                          placeholder="e.g., FAC001"
                          value={teacherMappingForm.teacherEmployeeId}
                          onChange={(e) => setTeacherMappingForm({...teacherMappingForm, teacherEmployeeId: e.target.value.toUpperCase()})}
                        />
                        <p className="text-xs text-muted-foreground">Teacher account must exist</p>
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800">
                      <p><strong>Assignment:</strong></p>
                      <p className="mt-1">Teacher <strong>{teacherMappingForm.teacherEmployeeId || '___'}</strong> will handle <strong>{teacherMappingForm.subjectCode || '___'}</strong></p>
                      <p>for <strong>{user?.departmentId}</strong> department, Batch <strong>{teacherMappingForm.batchYear}</strong>, Semester <strong>{teacherMappingForm.semesterNumber}</strong>, Section <strong>{teacherMappingForm.section}</strong></p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setTeacherMappingDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAssignTeacher} disabled={loading}>
                      {loading ? 'Assigning...' : 'Assign Teacher'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={openElectiveDialogOpen} onOpenChange={setOpenElectiveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Update Open Elective Choice
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Update Student Open Elective</DialogTitle>
                    <DialogDescription>
                      Select which open elective a student has opted for this semester.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="oe-usn">Student USN *</Label>
                      <Input
                        id="oe-usn"
                        placeholder="e.g., 1BM21CS001"
                        value={openElectiveForm.usn}
                        onChange={(e) => setOpenElectiveForm((prev) => ({ ...prev, usn: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Semester *</Label>
                      <Select
                        value={openElectiveForm.semesterNumber.toString()}
                        onValueChange={(value) => setOpenElectiveForm((prev) => ({ ...prev, semesterNumber: parseInt(value, 10) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEMESTER_OPTIONS.map((sem) => (
                            <SelectItem key={sem} value={sem.toString()}>
                              Semester {sem}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="oe-code">Open Elective Subject Code *</Label>
                      <Input
                        id="oe-code"
                        placeholder="e.g., CS9OE1"
                        value={openElectiveForm.subjectCode}
                        onChange={(e) => setOpenElectiveForm((prev) => ({ ...prev, subjectCode: e.target.value.toUpperCase() }))}
                      />
                      <p className="text-xs text-muted-foreground">Ensure the code matches one of the offered open electives for that semester.</p>
                    </div>
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      This will overwrite the current elective choice for the selected semester.
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpenElectiveDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdateOpenElectiveChoice} disabled={openElectiveSubmitting}>
                      {openElectiveSubmitting ? 'Updating...' : 'Save Choice'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
                </>
              )}

                <Button variant="default" onClick={() => setNoDueDialogOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Dispatch No-Due Requests
                </Button>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload Students
              </Button>
              <Button variant="outline">
                <Shield className="mr-2 h-4 w-4" />
                View Pending Approvals
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={noDueDialogOpen} onOpenChange={setNoDueDialogOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Dispatch No-Due Requests</DialogTitle>
              <DialogDescription>
                Auto-route every clearance to its mapped faculty, mentor, and common clearance owners for the selected cohort.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-semibold">Routing overview</p>
                <p className="mt-1">
                  Requests are generated per subject, open elective, mentor, and shared clearances (library, fees, sports, certificates).
                  Make sure curriculum, teacher mappings, and open elective choices are up to date before dispatching.
                </p>
                {academicContext ? (
                  <p className="mt-2 text-xs text-blue-800">
                    Active context: {academicContext.academicYear} • {academicContext.semesterType.toUpperCase()} semester
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-red-700">
                    Academic context is missing. Update it from the quick actions panel before proceeding.
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select
                      value={noDueForm.departmentId}
                      onValueChange={(value) => setNoDueForm((prev) => ({ ...prev, departmentId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments
                          .filter((dept) => dept !== 'ALL')
                          .map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Batch Year *</Label>
                  <Input
                    type="number"
                    value={noDueForm.batchYear}
                    onChange={(e) =>
                      setNoDueForm((prev) => ({
                        ...prev,
                        batchYear: e.target.value,
                      }))
                    }
                    placeholder="2021"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Semester *</Label>
                  <Select
                    value={noDueForm.semesterNumber.toString()}
                    onValueChange={(value) =>
                      setNoDueForm((prev) => ({ ...prev, semesterNumber: parseInt(value, 10) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMESTER_OPTIONS.map((sem) => (
                        <SelectItem key={sem} value={sem.toString()}>
                          Semester {sem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section *</Label>
                  <Select
                    value={noDueForm.section}
                    onValueChange={(value) => setNoDueForm((prev) => ({ ...prev, section: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_OPTIONS.map((section) => (
                        <SelectItem key={section} value={section}>
                          Section {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={loadNoDueEligibleStudents} disabled={eligibleLoading}>
                  {eligibleLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching cohort...
                    </>
                  ) : (
                    'Fetch Cohort'
                  )}
                </Button>
                <Button
                  onClick={handleGenerateNoDueDispatch}
                  disabled={generatingNoDue || eligibleStudents.length === 0 || selectedUsns.length === 0}
                >
                  {generatingNoDue ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending requests...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Requests
                    </>
                  )}
                </Button>
              </div>

              {eligibleError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>{eligibleError}</span>
                </div>
              )}

              {eligibleStudents.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>
                      {selectedUsns.length} of {eligibleStudents.length} student{eligibleStudents.length === 1 ? '' : 's'}
                       a0selected
                    </span>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                      <Checkbox
                        checked={selectedUsns.length > 0 && selectedUsns.length === eligibleStudents.length}
                        onCheckedChange={handleSelectAllEligible}
                      />
                      Select all
                    </label>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto rounded-lg border divide-y">
                    {eligibleStudents.map((student) => {
                      const isChecked = selectedUsns.includes(student.usn);
                      const missingMentor = !student.mentorEmployeeId;
                      return (
                        <div key={student.usn} className="flex items-center gap-3 px-4 py-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(value) => handleStudentSelectionChange(student.usn, value)}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{student.name}</p>
                            <p className="text-xs font-mono uppercase text-muted-foreground">
                              {student.usn} • Section {student.section}
                            </p>
                          </div>
                          {missingMentor && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                              Mentor missing
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {missingMentorSelected > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      {missingMentorSelected} selected student{missingMentorSelected === 1 ? '' : 's'} do not have a mentor mapped.
                      Mentor clearance will remain pending for them until the mapping is updated.
                    </div>
                  )}
                </div>
              )}

              {generationSummary && generationResults && generationResults.length > 0 && (
                <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex flex-col gap-1 text-sm text-green-900 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {generationSummary.totalRequests.toLocaleString()} request{generationSummary.totalRequests === 1 ? '' : 's'}
                         a0queued for {generationSummary.totalStudents} student{generationSummary.totalStudents === 1 ? '' : 's'}.
                      </span>
                    </div>
                    <div className="text-xs text-green-800">
                      {generationSummary.cleanSuccess} clean • {generationSummary.partial} partial • {generationSummary.failures} blocked
                    </div>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto divide-y divide-green-200 rounded-md border border-green-200 bg-white">
                    {generationResults.map((result) => {
                      const statusClass = result.success && result.errors.length === 0
                        ? 'text-green-600'
                        : result.requestsCreated > 0
                          ? 'text-amber-600'
                          : 'text-red-600';
                      const statusLabel = result.success && result.errors.length === 0
                        ? 'Complete'
                        : result.requestsCreated > 0 && result.errors.length > 0
                          ? 'Partial'
                          : 'Blocked';
                      return (
                        <div key={result.usn} className="px-4 py-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">{result.name}</span>
                            <span className={statusClass}>{statusLabel}</span>
                          </div>
                          <p className="text-xs font-mono uppercase text-muted-foreground">{result.usn}</p>
                          <p className="text-xs text-muted-foreground">{result.requestsCreated} request{result.requestsCreated === 1 ? '' : 's'} queued.</p>
                          {result.errors.length > 0 && (
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-700">
                              {result.errors.map((message, index) => (
                                <li key={index}>{message}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminDashboard;
