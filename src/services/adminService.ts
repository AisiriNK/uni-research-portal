/**
 * Admin Utility Service for No-Due Automation System
 * 
 * This service provides admin-only operations for managing:
 * - Academic context updates
 * - Curriculum management
 * - Teacher assignments
 * - Common clearance mappings
 * 
 * IMPORTANT: These operations should only be accessible to department_admin role.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  AcademicContext,
  Curriculum,
  CoreSubjectTeacherMapping,
  OpenElectiveOffering,
  CommonClearanceMapping,
  generateCurriculumId,
  generateCoreSubjectMappingId,
  generateOpenElectiveOfferingId,
} from '@/types/schema';

// ============================================================================
// ACADEMIC CONTEXT MANAGEMENT
// ============================================================================

/**
 * Updates academic context (semester and year)
 * Call this at the start of each semester
 */
export async function updateAcademicContext(
  academicYear: string,
  semesterType: 'odd' | 'even'
): Promise<void> {
  const docRef = doc(db, 'academic_context', 'current');
  await setDoc(docRef, {
    academicYear,
    semesterType,
  });
}

/**
 * Gets current academic context
 */
export async function getAcademicContext(): Promise<AcademicContext> {
  const docRef = doc(db, 'academic_context', 'current');
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Academic context not configured');
  }
  
  return docSnap.data() as AcademicContext;
}

// ============================================================================
// CURRICULUM MANAGEMENT
// ============================================================================

/**
 * Adds a new subject to curriculum
 */
export async function addCurriculum(curriculum: Omit<Curriculum, 'id'>): Promise<string> {
  const docId = generateCurriculumId(
    curriculum.departmentId,
    curriculum.batchYear,
    curriculum.semesterNumber,
    curriculum.subjectCode
  );
  
  const docRef = doc(db, 'curriculum', docId);
  await setDoc(docRef, curriculum);
  
  return docId;
}

/**
 * Adds multiple curriculum items in batch
 */
export async function addCurriculumBatch(curriculumItems: Omit<Curriculum, 'id'>[]): Promise<void> {
  const batch = writeBatch(db);
  
  for (const item of curriculumItems) {
    const docId = generateCurriculumId(
      item.departmentId,
      item.batchYear,
      item.semesterNumber,
      item.subjectCode
    );
    
    const docRef = doc(db, 'curriculum', docId);
    batch.set(docRef, item);
  }
  
  await batch.commit();
}

/**
 * Gets curriculum for a department, batch, and semester
 */
export async function getCurriculum(
  departmentId: string,
  batchYear: number,
  semesterNumber: number
): Promise<Curriculum[]> {
  const q = query(
    collection(db, 'curriculum'),
    where('departmentId', '==', departmentId),
    where('batchYear', '==', batchYear),
    where('semesterNumber', '==', semesterNumber)
  );
  
  const querySnap = await getDocs(q);
  return querySnap.docs.map(doc => doc.data() as Curriculum);
}

/**
 * Deletes a curriculum item
 */
export async function deleteCurriculum(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string
): Promise<void> {
  const docId = generateCurriculumId(departmentId, batchYear, semesterNumber, subjectCode);
  const docRef = doc(db, 'curriculum', docId);
  await deleteDoc(docRef);
}

// ============================================================================
// CORE SUBJECT TEACHER MAPPING
// ============================================================================

/**
 * Assigns a teacher to a core subject for a section
 */
export async function assignCoreSubjectTeacher(mapping: Omit<CoreSubjectTeacherMapping, 'id'>): Promise<string> {
  const docId = generateCoreSubjectMappingId(
    mapping.departmentId,
    mapping.batchYear,
    mapping.semesterNumber,
    mapping.section,
    mapping.subjectCode
  );
  
  const docRef = doc(db, 'core_subject_teacher_mapping', docId);
  await setDoc(docRef, mapping);
  
  return docId;
}

/**
 * Assigns teachers to core subjects in batch
 */
export async function assignCoreSubjectTeachersBatch(
  mappings: Omit<CoreSubjectTeacherMapping, 'id'>[]
): Promise<void> {
  const batch = writeBatch(db);
  
  for (const mapping of mappings) {
    const docId = generateCoreSubjectMappingId(
      mapping.departmentId,
      mapping.batchYear,
      mapping.semesterNumber,
      mapping.section,
      mapping.subjectCode
    );
    
    const docRef = doc(db, 'core_subject_teacher_mapping', docId);
    batch.set(docRef, mapping);
  }
  
  await batch.commit();
}

/**
 * Gets all teacher mappings for a section
 */
export async function getCoreSubjectMappings(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string
): Promise<CoreSubjectTeacherMapping[]> {
  const q = query(
    collection(db, 'core_subject_teacher_mapping'),
    where('departmentId', '==', departmentId),
    where('batchYear', '==', batchYear),
    where('semesterNumber', '==', semesterNumber),
    where('section', '==', section)
  );
  
  const querySnap = await getDocs(q);
  return querySnap.docs.map(doc => doc.data() as CoreSubjectTeacherMapping);
}

/**
 * Updates teacher assignment for a core subject
 */
export async function updateCoreSubjectTeacher(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string,
  subjectCode: string,
  newTeacherEmployeeId: string
): Promise<void> {
  const docId = generateCoreSubjectMappingId(
    departmentId,
    batchYear,
    semesterNumber,
    section,
    subjectCode
  );
  
  const docRef = doc(db, 'core_subject_teacher_mapping', docId);
  await setDoc(docRef, { teacherEmployeeId: newTeacherEmployeeId }, { merge: true });
}

/**
 * Deletes a core subject teacher mapping
 */
export async function deleteCoreSubjectMapping(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string,
  subjectCode: string
): Promise<void> {
  const docId = generateCoreSubjectMappingId(
    departmentId,
    batchYear,
    semesterNumber,
    section,
    subjectCode
  );
  
  const docRef = doc(db, 'core_subject_teacher_mapping', docId);
  await deleteDoc(docRef);
}

// ============================================================================
// OPEN ELECTIVE OFFERINGS
// ============================================================================

/**
 * Adds an open elective offering
 */
export async function addOpenElectiveOffering(
  offering: Omit<OpenElectiveOffering, 'id'>
): Promise<string> {
  const docId = generateOpenElectiveOfferingId(
    offering.departmentId,
    offering.batchYear,
    offering.semesterNumber,
    offering.subjectCode
  );
  
  const docRef = doc(db, 'open_elective_offerings', docId);
  await setDoc(docRef, offering);
  
  return docId;
}

/**
 * Adds multiple open elective offerings in batch
 */
export async function addOpenElectiveOfferingsBatch(
  offerings: Omit<OpenElectiveOffering, 'id'>[]
): Promise<void> {
  const batch = writeBatch(db);
  
  for (const offering of offerings) {
    const docId = generateOpenElectiveOfferingId(
      offering.departmentId,
      offering.batchYear,
      offering.semesterNumber,
      offering.subjectCode
    );
    
    const docRef = doc(db, 'open_elective_offerings', docId);
    batch.set(docRef, offering);
  }
  
  await batch.commit();
}

/**
 * Gets all open elective offerings for a semester
 */
export async function getOpenElectiveOfferings(
  departmentId: string,
  batchYear: number,
  semesterNumber: number
): Promise<OpenElectiveOffering[]> {
  const q = query(
    collection(db, 'open_elective_offerings'),
    where('departmentId', '==', departmentId),
    where('batchYear', '==', batchYear),
    where('semesterNumber', '==', semesterNumber)
  );
  
  const querySnap = await getDocs(q);
  return querySnap.docs.map(doc => doc.data() as OpenElectiveOffering);
}

/**
 * Updates teacher for an open elective offering
 */
export async function updateOpenElectiveTeacher(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string,
  newTeacherEmployeeId: string
): Promise<void> {
  const docId = generateOpenElectiveOfferingId(
    departmentId,
    batchYear,
    semesterNumber,
    subjectCode
  );
  
  const docRef = doc(db, 'open_elective_offerings', docId);
  await setDoc(docRef, { teacherEmployeeId: newTeacherEmployeeId }, { merge: true });
}

/**
 * Deletes an open elective offering
 */
export async function deleteOpenElectiveOffering(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string
): Promise<void> {
  const docId = generateOpenElectiveOfferingId(
    departmentId,
    batchYear,
    semesterNumber,
    subjectCode
  );
  
  const docRef = doc(db, 'open_elective_offerings', docId);
  await deleteDoc(docRef);
}

// ============================================================================
// COMMON CLEARANCE MANAGEMENT
// ============================================================================

/**
 * Updates common clearance mapping (assigns staff to clearance type)
 */
export async function updateCommonClearanceMapping(
  clearanceTypeId: string,
  teacherEmployeeId: string
): Promise<void> {
  const docRef = doc(db, 'common_clearance_mapping', clearanceTypeId);
  await setDoc(docRef, {
    clearanceTypeId,
    teacherEmployeeId,
  });
}

/**
 * Gets all common clearance mappings
 */
export async function getCommonClearanceMappings(): Promise<CommonClearanceMapping[]> {
  const querySnap = await getDocs(collection(db, 'common_clearance_mapping'));
  return querySnap.docs.map(doc => doc.data() as CommonClearanceMapping);
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Sets up complete curriculum for a semester
 * Use this to populate an entire semester at once
 */
export async function setupSemesterCurriculum(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjects: Array<{
    subjectCode: string;
    subjectName: string;
    subjectType: 'core' | 'open_elective';
  }>
): Promise<void> {
  const curriculumItems = subjects.map(subject => ({
    departmentId,
    batchYear,
    semesterNumber,
    ...subject,
  }));
  
  await addCurriculumBatch(curriculumItems);
}

/**
 * Assigns all core subjects for a section
 * Use this to assign teachers for an entire section at once
 */
export async function setupSectionTeachers(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string,
  assignments: Array<{
    subjectCode: string;
    teacherEmployeeId: string;
  }>
): Promise<void> {
  const mappings = assignments.map(assignment => ({
    departmentId,
    batchYear,
    semesterNumber,
    section,
    ...assignment,
  }));
  
  await assignCoreSubjectTeachersBatch(mappings);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates if a teacher exists
 */
export async function validateTeacher(employeeId: string): Promise<boolean> {
  const docRef = doc(db, 'teachers', employeeId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
}

/**
 * Validates if a subject exists in curriculum
 */
export async function validateCurriculumSubject(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string
): Promise<boolean> {
  const docId = generateCurriculumId(departmentId, batchYear, semesterNumber, subjectCode);
  const docRef = doc(db, 'curriculum', docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
}
