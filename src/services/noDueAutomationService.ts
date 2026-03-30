/**
 * No-Due Automation Service
 * 
 * This service handles automatic no-due request generation and routing
 * based on the student's curriculum, section, and assigned teachers.
 * 
 * DISPATCH RECIPIENTS:
 * When a no-due is dispatched for a student, clearance requests are sent to:
 * 1. All Subject Teachers - One request per core subject the student takes
 * 2. Open Elective Teacher - If student has chosen an open elective
 * 3. Mentor - Student's assigned mentor (handles fees clearance as well)
 * 4. Library - Institution-wide librarian (library clearance)
 * 5. Sports - Department-scoped sports coordinator (sports clearance)
 * 6. Certificate - Department-scoped certificate coordinator (certificate clearance)
 * 
 * KEY FEATURES:
 * - Automatic semester calculation based on batch year
 * - Auto-routing to correct teachers (NO manual teacher selection)
 * - Handles core subjects, open electives, and common clearances
 * - Routes mentor clearance to student's assigned mentor
 * - Routes library clearance to institution-wide librarian
 * - Routes sports/certificate clearances to department-specific teachers
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
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
  NoDueStatus,
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
// Fees are handled by mentor clearance now.
const COMMON_CLEARANCES = ['library', 'sports', 'certificate'] as const;

const APPROVED_STATUSES: NoDueStatus[] = ['approved', 'mentor_approved', 'completed'];

export interface MentorStudentSummary {
  student: Pick<Student, 'usn' | 'name' | 'departmentId' | 'section' | 'batchYear'> & {
    semesterNumber?: number | null;
  };
  requests: NoDueRequestWithDetails[];
  mentorRequest?: NoDueRequestWithDetails;
  readyForMentorApproval: boolean;
  pendingCategories: Array<{ referenceId: string; referenceType: string; status: NoDueStatus }>;
}

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
 * Searches for librarian with departmentId = 'ALL', 'institution', or just role='librarian'
 */
export async function getLibrarian(): Promise<Teacher> {
  // Try with 'ALL' first (most common)
  let q = query(
    collection(db, COLLECTIONS.TEACHERS),
    where('role', '==', 'librarian'),
    where('departmentId', '==', 'ALL')
  );
  
  let querySnap = await getDocs(q);
  
  if (!querySnap.empty) {
    return querySnap.docs[0].data() as Teacher;
  }
  
  // Fallback: try 'institution'
  q = query(
    collection(db, COLLECTIONS.TEACHERS),
    where('role', '==', 'librarian'),
    where('departmentId', '==', 'institution')
  );
  
  querySnap = await getDocs(q);
  
  if (!querySnap.empty) {
    return querySnap.docs[0].data() as Teacher;
  }
  
  // Final fallback: just find any librarian (no department filter)
  q = query(
    collection(db, COLLECTIONS.TEACHERS),
    where('role', '==', 'librarian')
  );
  
  querySnap = await getDocs(q);
  
  if (!querySnap.empty) {
    return querySnap.docs[0].data() as Teacher;
  }
  
  throw new Error('No librarian configured. Please create a teacher with role "librarian".');
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
  subjectCode: string,
  section?: string
): Promise<string> {
  const docId = `${departmentId}_${batchYear}_${semesterNumber}_${subjectCode}`;
  const docRef = doc(db, COLLECTIONS.OPEN_ELECTIVE_OFFERINGS, docId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const offering = docSnap.data() as OpenElectiveOffering;
    return offering.teacherEmployeeId;
  }

  if (section) {
    const fallbackId = `${departmentId}_${batchYear}_${semesterNumber}_${section}_${subjectCode}`;
    const fallbackRef = doc(db, COLLECTIONS.CORE_SUBJECT_TEACHER_MAPPING, fallbackId);
    const fallbackSnap = await getDoc(fallbackRef);
    if (fallbackSnap.exists()) {
      const mapping = fallbackSnap.data() as CoreSubjectTeacherMapping;
      console.warn('[getOpenElectiveTeacher] fallback to core mapping for elective', {
        subjectCode,
        section,
      });
      return mapping.teacherEmployeeId;
    }
  }
  
  throw new Error(`Open elective ${subjectCode} not offered`);
}

/**
 * Fetches teacher responsible for a common clearance
 */
export async function getCommonClearanceTeacher(
  clearanceTypeId: string,
  departmentId: string
): Promise<string> {
  const scopedDocId = `${departmentId}_${clearanceTypeId}`;
  const scopedRef = doc(db, COLLECTIONS.COMMON_CLEARANCE_MAPPING, scopedDocId);
  const scopedSnap = await getDoc(scopedRef);

  if (scopedSnap.exists()) {
    const mapping = scopedSnap.data() as CommonClearanceMapping;
    return mapping.teacherEmployeeId;
  }

  const legacyRef = doc(db, COLLECTIONS.COMMON_CLEARANCE_MAPPING, clearanceTypeId);
  const legacySnap = await getDoc(legacyRef);

  if (!legacySnap.exists()) {
    throw new Error(`No staff assigned for ${clearanceTypeId} clearance`);
  }

  const mapping = legacySnap.data() as CommonClearanceMapping;
  return mapping.teacherEmployeeId;
}

// ============================================================================
// NO-DUE REQUEST GENERATION (AUTO-ROUTING)
// ============================================================================

/**
 * Generates ALL no-due requests for a student automatically
 * 
 * This function creates clearance requests and routes them to:
 * 1. Core Subject Teachers - Each student's core subjects (section-specific)
 * 2. Open Elective Teacher - If student has chosen an elective
 * 3. Sports Coordinator - Department-scoped sports clearance (from common_clearance_mapping)
 * 4. Certificate Coordinator - Department-scoped certificate clearance (from common_clearance_mapping)
 * 5. Librarian - Institution-wide librarian for library clearance
 * 6. Mentor - Student's assigned mentor (also handles fees)
 * 
 * No manual teacher selection needed - all routing is automatic!
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
          electiveChoice.subjectCode,
          student.section
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
          teacherEmployeeId = await getCommonClearanceTeacher(clearanceType, student.departmentId);
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
  console.log('[NoDueAutomationService] getStudentNoDueRequests snapshot', {
    usn,
    count: querySnap.size,
  });
  const requests: NoDueRequestWithDetails[] = [];
  
  for (const docSnap of querySnap.docs) {
    const request = docSnap.data() as NoDueRequest;
    
    // Fetch teacher details
    const teacher = await getTeacher(request.teacherEmployeeId);
    console.log('[NoDueAutomationService] Hydrated request', {
      docId: docSnap.id,
      status: request.status,
      teacherEmployeeId: request.teacherEmployeeId,
      teacherFound: Boolean(teacher),
    });
    
    requests.push({
      ...request,
      teacherName: teacher.name,
      teacherEmail: teacher.email,
    });
  }
  
  return requests;
}

export async function getMentorStudentSummaries(employeeId: string): Promise<MentorStudentSummary[]> {
  const studentsQuery = query(
    collection(db, COLLECTIONS.STUDENTS),
    where('mentorEmployeeId', '==', employeeId)
  );
  const studentsSnap = await getDocs(studentsQuery);
  const summaries: MentorStudentSummary[] = [];

  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data() as Student;
    const requests = await getStudentNoDueRequests(student.usn);
    const mentorRequest = requests.find((request) => request.referenceType === 'mentor');
    const nonMentorRequests = requests.filter((request) => request.referenceType !== 'mentor');
    const pendingCategories = nonMentorRequests
      .filter((request) => !APPROVED_STATUSES.includes(request.status))
      .map((request) => ({
        referenceId: request.referenceId,
        referenceType: request.referenceType,
        status: request.status,
      }));

    const readyForMentorApproval =
      nonMentorRequests.length > 0 &&
      pendingCategories.length === 0 &&
      ['pending_mentor_approval', 'pending', 'resubmitted'].includes(mentorRequest?.status ?? '');

    if (readyForMentorApproval && mentorRequest?.status === 'pending') {
      const mentorRequestId = generateNoDueRequestId(student.usn, 'mentor');
      await updateDoc(doc(db, COLLECTIONS.NO_DUE_REQUESTS, mentorRequestId), {
        status: 'pending_mentor_approval',
        mentorApprovalStatus: 'pending',
      });
    }

    summaries.push({
      student: {
        usn: student.usn,
        name: student.name,
        departmentId: student.departmentId,
        section: student.section,
        batchYear: student.batchYear,
        semesterNumber: requests[0]?.semesterNumber ?? null,
      },
      requests,
      mentorRequest,
      readyForMentorApproval,
      pendingCategories,
    });
  }

  return summaries.sort((a, b) => a.student.usn.localeCompare(b.student.usn));
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
  if (request.referenceType === 'mentor') {
    await setDoc(requestRef, {
      status: 'mentor_approved',
      mentorApprovalStatus: 'approved',
      mentorApprovedAt: Timestamp.now(),
      approvedAt: Timestamp.now(),
    }, { merge: true });
  } else {
    await setDoc(requestRef, {
      status: 'approved',
      approvedAt: Timestamp.now(),
    }, { merge: true });
  }
  
  // Check if this was the last pending teacher approval
  try {
    await checkAndUpdateMentorApprovalStatus(request.usn);
  } catch (error) {
    // Teachers only have access to their own documents; skip mentor aggregation if access is denied
    if (import.meta.env.DEV) {
      console.warn('[approveNoDueRequest] mentor aggregation skipped', error);
    }
  }
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
  
  const request = requestSnap.data() as NoDueRequest;

  if (request.referenceType === 'mentor') {
    await setDoc(requestRef, {
      status: 'mentor_rejected',
      mentorApprovalStatus: 'rejected',
      mentorApprovedAt: Timestamp.now(),
      approvedAt: Timestamp.now(),
      rejectionReason: reason,
      mentorRejectionReason: reason,
    }, { merge: true });
  } else {
    await setDoc(requestRef, {
      status: 'rejected',
      approvedAt: Timestamp.now(),
      rejectionReason: reason,
    }, { merge: true });
  }
}

/**
 * Resubmits a rejected no-due request with student comments
 */
export async function resubmitNoDueRequest(requestId: string, comment: string): Promise<void> {
  const requestRef = doc(db, COLLECTIONS.NO_DUE_REQUESTS, requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error('Request not found');
  }

  const request = requestSnap.data() as NoDueRequest;

  if (request.status !== 'rejected' && request.status !== 'mentor_rejected') {
    throw new Error('Only rejected requests can be resubmitted');
  }

  await setDoc(
    requestRef,
    {
      status: 'resubmitted',
      studentResubmissionComment: comment,
      resubmittedAt: Timestamp.now(),
    },
    { merge: true }
  );
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
  const pendingCount = requests.filter(r => ['pending', 'resubmitted', 'pending_mentor_approval'].includes(r.status)).length;
  const rejectedCount = requests.filter(r => ['rejected', 'mentor_rejected'].includes(r.status)).length;
  
  return {
    allApproved: totalRequests > 0 && approvedCount === totalRequests,
    totalRequests,
    approvedCount,
    pendingCount,
    rejectedCount,
  };
}
