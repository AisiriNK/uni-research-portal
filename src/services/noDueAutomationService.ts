/**
 * No-Due Automation Service
 * 
 * This service handles automatic no-due request generation and routing
 * based on the student's curriculum, section, and assigned teachers.
 * 
 * KEY FEATURES:
 * - Automatic semester calculation based on batch year
 * - Auto-routing to correct teachers (NO manual teacher selection)
 * - Handles core subjects, open electives, and common clearances
 * - Routes mentor clearance to student's assigned mentor
 * - Routes library clearance to institution-wide librarian
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  Student,
  Teacher,
  AcademicContext,
  Curriculum,
  CoreSubjectTeacherMapping,
  OpenElectiveOffering,
  StudentElectiveChoice,
  CommonClearanceMapping,
  NoDueRequest,
  NoDueRequestWithDetails,
  calculateSemester,
  generateNoDueRequestId,
} from '@/types/schema';

// ============================================================================
// COLLECTION NAMES (CONSTANTS)
// ============================================================================

const COLLECTIONS = {
  STUDENTS: 'students',
  TEACHERS: 'teachers',
  ACADEMIC_CONTEXT: 'academic_context',
  CURRICULUM: 'curriculum',
  CORE_SUBJECT_TEACHER_MAPPING: 'core_subject_teacher_mapping',
  OPEN_ELECTIVE_OFFERINGS: 'open_elective_offerings',
  STUDENT_ELECTIVE_CHOICE: 'student_elective_choice',
  COMMON_CLEARANCE_MAPPING: 'common_clearance_mapping',
  NO_DUE_REQUESTS: 'no_due_requests',
} as const;

// Fixed common clearance IDs (must match common_clearance_types collection)
const COMMON_CLEARANCES = ['library', 'fees', 'sports', 'certificate'] as const;

// ============================================================================
// ACADEMIC CONTEXT
// ============================================================================

/**
 * Fetches current academic context (singleton document with ID "current")
 */
export async function getAcademicContext(): Promise<AcademicContext> {
  const docRef = doc(db, COLLECTIONS.ACADEMIC_CONTEXT, 'current');
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Academic context not configured. Please contact admin.');
  }
  
  return docSnap.data() as AcademicContext;
}

/**
 * Updates academic context (admin only)
 */
export async function updateAcademicContext(
  academicYear: string,
  semesterType: 'odd' | 'even'
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ACADEMIC_CONTEXT, 'current');
  await setDoc(docRef, { academicYear, semesterType });
}

// ============================================================================
// STUDENT OPERATIONS
// ============================================================================

/**
 * Fetches student with computed current semester
 */
export async function getStudentWithSemester(usn: string): Promise<Student & { currentSemester: number }> {
  const studentRef = doc(db, COLLECTIONS.STUDENTS, usn);
  const studentSnap = await getDoc(studentRef);
  
  if (!studentSnap.exists()) {
    throw new Error('Student not found');
  }
  
  const student = studentSnap.data() as Student;
  const context = await getAcademicContext();
  const currentSemester = calculateSemester(student.batchYear, context.academicYear, context.semesterType);
  
  return { ...student, currentSemester };
}

// ============================================================================
// TEACHER OPERATIONS
// ============================================================================

/**
 * Fetches teacher by employee ID
 */
export async function getTeacher(employeeId: string): Promise<Teacher> {
  const teacherRef = doc(db, COLLECTIONS.TEACHERS, employeeId);
  const teacherSnap = await getDoc(teacherRef);
  
  if (!teacherSnap.exists()) {
    throw new Error('Teacher not found');
  }
  
  return teacherSnap.data() as Teacher;
}

/**
 * Fetches institution-wide librarian
 */
export async function getLibrarian(): Promise<Teacher> {
  const q = query(
    collection(db, COLLECTIONS.TEACHERS),
    where('role', '==', 'librarian'),
    where('departmentId', '==', 'institution')
  );
  
  const querySnap = await getDocs(q);
  
  if (querySnap.empty) {
    throw new Error('No librarian configured. Please contact admin.');
  }
  
  // Return first librarian found
  return querySnap.docs[0].data() as Teacher;
}

// ============================================================================
// CURRICULUM AND TEACHER MAPPING
// ============================================================================

/**
 * Fetches all core subjects for a student's current semester
 */
export async function getCoreSubjectsForStudent(
  student: Student,
  semesterNumber: number
): Promise<Curriculum[]> {
  const q = query(
    collection(db, COLLECTIONS.CURRICULUM),
    where('departmentId', '==', student.departmentId),
    where('batchYear', '==', student.batchYear),
    where('semesterNumber', '==', semesterNumber),
    where('subjectType', '==', 'core')
  );
  
  const querySnap = await getDocs(q);
  return querySnap.docs.map(doc => doc.data() as Curriculum);
}

/**
 * Fetches teacher assigned to a core subject for a specific section
 */
export async function getCoreSubjectTeacher(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string,
  subjectCode: string
): Promise<string> {
  const docId = `${departmentId}_${batchYear}_${semesterNumber}_${section}_${subjectCode}`;
  const docRef = doc(db, COLLECTIONS.CORE_SUBJECT_TEACHER_MAPPING, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error(`No teacher assigned for ${subjectCode} (Section ${section})`);
  }
  
  const mapping = docSnap.data() as CoreSubjectTeacherMapping;
  return mapping.teacherEmployeeId;
}

/**
 * Fetches student's chosen elective for a semester
 */
export async function getStudentElectiveChoice(
  usn: string,
  semesterNumber: number
): Promise<StudentElectiveChoice | null> {
  const docId = `${usn}_${semesterNumber}`;
  const docRef = doc(db, COLLECTIONS.STUDENT_ELECTIVE_CHOICE, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return docSnap.data() as StudentElectiveChoice;
}

/**
 * Fetches teacher assigned to an open elective
 */
export async function getOpenElectiveTeacher(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string
): Promise<string> {
  const docId = `${departmentId}_${batchYear}_${semesterNumber}_${subjectCode}`;
  const docRef = doc(db, COLLECTIONS.OPEN_ELECTIVE_OFFERINGS, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error(`Open elective ${subjectCode} not offered`);
  }
  
  const offering = docSnap.data() as OpenElectiveOffering;
  return offering.teacherEmployeeId;
}

/**
 * Fetches teacher responsible for a common clearance
 */
export async function getCommonClearanceTeacher(clearanceTypeId: string): Promise<string> {
  const docRef = doc(db, COLLECTIONS.COMMON_CLEARANCE_MAPPING, clearanceTypeId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error(`No staff assigned for ${clearanceTypeId} clearance`);
  }
  
  const mapping = docSnap.data() as CommonClearanceMapping;
  return mapping.teacherEmployeeId;
}

// ============================================================================
// NO-DUE REQUEST GENERATION (AUTO-ROUTING)
// ============================================================================

/**
 * Generates ALL no-due requests for a student automatically
 * 
 * This function:
 * 1. Calculates student's current semester
 * 2. Fetches all core subjects for the semester
 * 3. Routes each core subject to section-specific teacher
 * 4. Routes open elective to assigned teacher
 * 5. Routes common clearances (library, fees, sports, certificate)
 * 6. Routes mentor clearance to student's assigned mentor
 * 
 * NO MANUAL TEACHER SELECTION - All routing is automatic!
 */
export async function generateNoDueRequests(usn: string): Promise<{
  success: boolean;
  requestsCreated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let requestsCreated = 0;
  
  try {
    // Step 1: Fetch student and calculate current semester
    const student = await getStudentWithSemester(usn);
    const { currentSemester } = student;
    
    // Use batch writes for atomicity
    const batch = writeBatch(db);
    
    // Step 2: Generate core subject no-due requests
    const coreSubjects = await getCoreSubjectsForStudent(student, currentSemester);
    
    for (const subject of coreSubjects) {
      try {
        const teacherEmployeeId = await getCoreSubjectTeacher(
          student.departmentId,
          student.batchYear,
          currentSemester,
          student.section,
          subject.subjectCode
        );
        
        const requestId = generateNoDueRequestId(usn, subject.subjectCode);
        const requestRef = doc(db, COLLECTIONS.NO_DUE_REQUESTS, requestId);
        
        const request: NoDueRequest = {
          usn: student.usn,
          studentName: student.name,
          departmentId: student.departmentId,
          batchYear: student.batchYear,
          semesterNumber: currentSemester,
          section: student.section,
          referenceType: 'core_subject',
          referenceId: subject.subjectCode,
          teacherEmployeeId,
          status: 'pending',
          requestedAt: Timestamp.now(),
        };
        
        batch.set(requestRef, request);
        requestsCreated++;
      } catch (error: any) {
        errors.push(`Core subject ${subject.subjectCode}: ${error.message}`);
      }
    }
    
    // Step 3: Generate open elective no-due request
    const electiveChoice = await getStudentElectiveChoice(usn, currentSemester);
    
    if (electiveChoice) {
      try {
        const teacherEmployeeId = await getOpenElectiveTeacher(
          student.departmentId,
          student.batchYear,
          currentSemester,
          electiveChoice.subjectCode
        );
        
        const requestId = generateNoDueRequestId(usn, electiveChoice.subjectCode);
        const requestRef = doc(db, COLLECTIONS.NO_DUE_REQUESTS, requestId);
        
        const request: NoDueRequest = {
          usn: student.usn,
          studentName: student.name,
          departmentId: student.departmentId,
          batchYear: student.batchYear,
          semesterNumber: currentSemester,
          section: student.section,
          referenceType: 'open_elective',
          referenceId: electiveChoice.subjectCode,
          teacherEmployeeId,
          status: 'pending',
          requestedAt: Timestamp.now(),
        };
        
        batch.set(requestRef, request);
        requestsCreated++;
      } catch (error: any) {
        errors.push(`Open elective: ${error.message}`);
      }
    } else {
      errors.push('No open elective choice recorded');
    }
    
    // Step 4: Generate common clearance no-due requests
    for (const clearanceType of COMMON_CLEARANCES) {
      try {
        // Library is special: use institution-wide librarian
        let teacherEmployeeId: string;
        
        if (clearanceType === 'library') {
          const librarian = await getLibrarian();
          teacherEmployeeId = librarian.employeeId;
        } else {
          teacherEmployeeId = await getCommonClearanceTeacher(clearanceType);
        }
        
        const requestId = generateNoDueRequestId(usn, clearanceType);
        const requestRef = doc(db, COLLECTIONS.NO_DUE_REQUESTS, requestId);
        
        const request: NoDueRequest = {
          usn: student.usn,
          studentName: student.name,
          departmentId: student.departmentId,
          batchYear: student.batchYear,
          semesterNumber: currentSemester,
          section: student.section,
          referenceType: 'common_clearance',
          referenceId: clearanceType,
          teacherEmployeeId,
          status: 'pending',
          requestedAt: Timestamp.now(),
        };
        
        batch.set(requestRef, request);
        requestsCreated++;
      } catch (error: any) {
        errors.push(`${clearanceType}: ${error.message}`);
      }
    }
    
    // Step 5: Generate mentor clearance no-due request
    try {
      const requestId = generateNoDueRequestId(usn, 'mentor');
      const requestRef = doc(db, COLLECTIONS.NO_DUE_REQUESTS, requestId);
      
      const request: NoDueRequest = {
        usn: student.usn,
        studentName: student.name,
        departmentId: student.departmentId,
        batchYear: student.batchYear,
        semesterNumber: currentSemester,
        section: student.section,
        referenceType: 'mentor',
        referenceId: 'mentor',
        teacherEmployeeId: student.mentorEmployeeId, // Routes to assigned mentor
        status: 'pending',
        requestedAt: Timestamp.now(),
      };
      
      batch.set(requestRef, request);
      requestsCreated++;
    } catch (error: any) {
      errors.push(`Mentor clearance: ${error.message}`);
    }
    
    // Commit all requests
    await batch.commit();
    
    return {
      success: requestsCreated > 0,
      requestsCreated,
      errors,
    };
  } catch (error: any) {
    throw new Error(`Failed to generate no-due requests: ${error.message}`);
  }
}

// ============================================================================
// NO-DUE REQUEST QUERIES
// ============================================================================

/**
 * Fetches all no-due requests for a student
 */
export async function getStudentNoDueRequests(usn: string): Promise<NoDueRequestWithDetails[]> {
  const q = query(
    collection(db, COLLECTIONS.NO_DUE_REQUESTS),
    where('usn', '==', usn)
  );
  
  const querySnap = await getDocs(q);
  const requests: NoDueRequestWithDetails[] = [];
  
  for (const docSnap of querySnap.docs) {
    const request = docSnap.data() as NoDueRequest;
    
    // Fetch teacher details
    const teacher = await getTeacher(request.teacherEmployeeId);
    
    requests.push({
      ...request,
      teacherName: teacher.name,
      teacherEmail: teacher.email,
    });
  }
  
  return requests;
}

/**
 * Fetches all no-due requests assigned to a teacher
 * Teachers ONLY see requests where teacherEmployeeId matches their ID
 */
export async function getTeacherNoDueRequests(employeeId: string): Promise<NoDueRequestWithDetails[]> {
  const q = query(
    collection(db, COLLECTIONS.NO_DUE_REQUESTS),
    where('teacherEmployeeId', '==', employeeId)
  );
  
  const querySnap = await getDocs(q);
  const requests: NoDueRequestWithDetails[] = [];
  
  for (const docSnap of querySnap.docs) {
    const request = docSnap.data() as NoDueRequest;
    
    // Fetch teacher details (self)
    const teacher = await getTeacher(request.teacherEmployeeId);
    
    requests.push({
      ...request,
      teacherName: teacher.name,
      teacherEmail: teacher.email,
    });
  }
  
  return requests;
}

/**
 * Approves a no-due request (teacher only)
 * 
 * After approval, checks if all non-mentor requests are approved.
 * If yes, automatically updates mentor request to "pending_mentor_approval"
 */
export async function approveNoDueRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, COLLECTIONS.NO_DUE_REQUESTS, requestId);
  const requestSnap = await getDoc(requestRef);
  
  if (!requestSnap.exists()) {
    throw new Error('Request not found');
  }
  
  const request = requestSnap.data() as NoDueRequest;
  
  // Approve this request
  await setDoc(requestRef, {
    status: 'approved',
    approvedAt: Timestamp.now(),
  }, { merge: true });
  
  // Check if this was the last pending teacher approval
  await checkAndUpdateMentorApprovalStatus(request.usn);
}

/**
 * Checks if all teacher approvals are complete and updates mentor request status
 * @internal
 */
async function checkAndUpdateMentorApprovalStatus(usn: string): Promise<void> {
  // Get all requests for this student
  const q = query(
    collection(db, COLLECTIONS.NO_DUE_REQUESTS),
    where('usn', '==', usn)
  );
  const querySnap = await getDocs(q);
  const requests = querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NoDueRequest & { id: string }));
  
  // Separate mentor and non-mentor requests
  const mentorRequest = requests.find(r => r.referenceType === 'mentor');
  const nonMentorRequests = requests.filter(r => r.referenceType !== 'mentor');
  
  // Check if all non-mentor requests are approved
  const allTeachersApproved = nonMentorRequests.every(r => r.status === 'approved');
  
  // If all teachers approved, update mentor request to pending_mentor_approval
  if (allTeachersApproved && mentorRequest && mentorRequest.status === 'pending') {
    const mentorRequestRef = doc(db, COLLECTIONS.NO_DUE_REQUESTS, mentorRequest.id);
    await setDoc(mentorRequestRef, {
      status: 'pending_mentor_approval',
      mentorApprovalStatus: 'pending',
    }, { merge: true });
  }
}

/**
 * Rejects a no-due request with reason (teacher only)
 */
export async function rejectNoDueRequest(requestId: string, reason: string): Promise<void> {
  const requestRef = doc(db, COLLECTIONS.NO_DUE_REQUESTS, requestId);
  const requestSnap = await getDoc(requestRef);
  
  if (!requestSnap.exists()) {
    throw new Error('Request not found');
  }
  
  await setDoc(requestRef, {
    status: 'rejected',
    approvedAt: Timestamp.now(),
    rejectionReason: reason,
  }, { merge: true });
}

/**
 * Checks if all no-due requests are approved for a student
 */
export async function checkNoDueClearanceStatus(usn: string): Promise<{
  allApproved: boolean;
  totalRequests: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
}> {
  const requests = await getStudentNoDueRequests(usn);
  
  const totalRequests = requests.length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;
  
  return {
    allApproved: totalRequests > 0 && approvedCount === totalRequests,
    totalRequests,
    approvedCount,
    pendingCount,
    rejectedCount,
  };
}
