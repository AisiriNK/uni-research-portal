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
import { calculateSemester, AcademicContext } from '@/types/schema';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, setDoc, where, serverTimestamp } from 'firebase/firestore';
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
    const teachersQuery = departmentScope ? query(teachersRef, where('departmentId', '==', departmentScope)) : teachersRef;
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
      const teachersQuery = departmentScope
        ? query(teachersRef, where('departmentId', '==', departmentScope))
        : query(teachersRef, orderBy('employeeId'));
      const snapshot = await getDocs(teachersQuery);
      const records = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      const sorted = departmentScope
        ? [...records].sort((a, b) => a.employeeId.localeCompare(b.employeeId))
        : records;
      setTeacherList(sorted);
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
                <span className="text-3xl font-bold text-orange-600">0</span>
              </div>
              <CardTitle className="mt-4">Hall Tickets</CardTitle>
              <CardDescription>
                Generate hall tickets after clearances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
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
                    <th className="px-4 py-3">Role</th>
                    {isSuperAdmin && <th className="px-4 py-3">Department</th>}
                    <th className="px-4 py-3">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading.teachers ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">
                        Loading teachers...
                      </td>
                    </tr>
                  ) : filteredTeacherList.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">
                        No teachers match the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTeacherList.map((teacher) => (
                      <tr key={teacher.id} className="border-t">
                        <td className="px-4 py-3 font-mono text-xs uppercase">{teacher.employeeId}</td>
                        <td className="px-4 py-3">{teacher.name}</td>
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
                            <th className="px-4 py-3">Teacher</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openElectiveAssignments.map((row) => (
                            <tr key={row.subjectCode} className="border-t">
                              <td className="px-4 py-3 font-medium">{row.subjectName}</td>
                              <td className="px-4 py-3 font-mono text-xs uppercase">{row.subjectCode}</td>
                              <td className="px-4 py-3">
                                <span className="font-medium">{row.teacherName}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{row.teacherEmployeeId}</span>
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

        <Dialog open={studentDetailOpen} onOpenChange={(open) => {
          setStudentDetailOpen(open);
          if (!open) {
            setSelectedStudent(null);
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium break-all">{selectedStudent.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mentor ID</p>
                    <p className="font-medium">{selectedStudent.mentorEmployeeId || 'Not assigned'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">{selectedStudent.dateOfBirth || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Semester</p>
                    <p className="font-medium">{selectedStudent.currentSemester ?? '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Batch Year</p>
                    <p className="font-medium">{selectedStudent.batchYear}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Section</p>
                    <p className="font-medium">{selectedStudent.section}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="font-medium">{selectedStudent.departmentId}</p>
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
                      <div className="space-y-2">
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
