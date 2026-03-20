import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import { NoDueSubmission, CreateSubmissionData, UpdateSubmissionData } from '@/types/nodue';
import { logNoDueEvent } from '@/lib/logging';

const SUBMISSIONS_COLLECTION = 'noDueSubmissions';

/**
 * Upload PDF file to Firebase Storage
 */
export async function uploadSubmissionPDF(file: File, studentId: string): Promise<{url: string, name: string}> {
  const timestamp = Date.now();
  const fileName = `${studentId}_${timestamp}_${file.name}`;
  const storageRef = ref(storage, `no-due-submissions/${studentId}/${fileName}`);
  logNoDueEvent('submission:upload_start', { studentId, fileName });

  try {
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    logNoDueEvent('submission:upload_success', { studentId, fileName });
    
    return { url, name: file.name };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logNoDueEvent('submission:upload_error', { studentId, fileName, message }, 'error');
    throw error;
  }
}

/**
 * Create a new no-due submission
 */
export async function createSubmission(
  studentData: {
    id: string;
    name: string;
    email: string;
    dept: string;
    regNo: string;
  },
  submissionData: CreateSubmissionData
): Promise<string> {
  try {
    logNoDueEvent('submission:create_start', {
      studentId: studentData.id,
      teacherId: submissionData.teacherId,
      category: submissionData.metadata?.category,
    });
    // Upload PDF first
    const { url, name } = await uploadSubmissionPDF(submissionData.pdfFile, studentData.id);
    
    // Create submission document
    const submission = {
      studentId: studentData.id,
      studentName: studentData.name,
      studentEmail: studentData.email,
      studentDept: studentData.dept,
      studentRegNo: studentData.regNo,
      
      teacherId: submissionData.teacherId,
      teacherName: submissionData.teacherName,
      teacherEmail: submissionData.teacherEmail,
      
      pdfUrl: url,
      pdfName: name,
      
      metadata: submissionData.metadata,
      
      status: 'pending',
      
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, SUBMISSIONS_COLLECTION), submission);
    logNoDueEvent('submission:create_success', { submissionId: docRef.id, studentId: studentData.id });
    return docRef.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logNoDueEvent('submission:create_error', { studentId: studentData.id, message }, 'error');
    console.error('Error creating submission:', error);
    throw new Error('Failed to create submission');
  }
}

/**
 * Get all submissions for a student
 */
export async function getStudentSubmissions(studentId: string): Promise<NoDueSubmission[]> {
  try {
    logNoDueEvent('student_submissions:fetch_start', { studentId });
    const q = query(
      collection(db, SUBMISSIONS_COLLECTION),
      where('studentId', '==', studentId)
    );
    
    const querySnapshot = await getDocs(q);
    const submissions: NoDueSubmission[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      submissions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        reviewedAt: data.reviewedAt?.toDate(),
        resubmittedAt: data.resubmittedAt?.toDate(),
      } as NoDueSubmission);
    });
    
    // Sort in memory instead of using orderBy (avoids index requirement)
    const ordered = submissions.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA; // desc order
    });
    logNoDueEvent('student_submissions:fetch_success', { studentId, count: ordered.length });
    return ordered;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logNoDueEvent('student_submissions:fetch_error', { studentId, message }, 'error');
    console.error('Error getting student submissions:', error);
    throw new Error('Failed to fetch submissions');
  }
}

/**
 * Get all submissions for a teacher
 */
export async function getTeacherSubmissions(teacherId: string): Promise<NoDueSubmission[]> {
  try {
    logNoDueEvent('teacher_submissions:fetch_start', { teacherId });
    const q = query(
      collection(db, SUBMISSIONS_COLLECTION),
      where('teacherId', '==', teacherId)
    );
    
    const querySnapshot = await getDocs(q);
    const submissions: NoDueSubmission[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      submissions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        reviewedAt: data.reviewedAt?.toDate(),
        resubmittedAt: data.resubmittedAt?.toDate(),
      } as NoDueSubmission);
    });
    
    // Sort in memory instead of using orderBy (avoids index requirement)
    const ordered = submissions.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA; // desc order
    });
    logNoDueEvent('teacher_submissions:fetch_success', { teacherId, count: ordered.length });
    return ordered;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logNoDueEvent('teacher_submissions:fetch_error', { teacherId, message }, 'error');
    console.error('Error getting teacher submissions:', error);
    throw new Error('Failed to fetch submissions');
  }
}

/**
 * Update submission status (approve/reject)
 */
export async function updateSubmissionStatus(
  submissionId: string,
  updateData: UpdateSubmissionData
): Promise<void> {
  try {
    logNoDueEvent('submission:update_start', { submissionId, status: updateData.status });
    const submissionRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    
    await updateDoc(submissionRef, {
      status: updateData.status,
      teacherComments: updateData.teacherComments || '',
      reviewedAt: Timestamp.fromDate(updateData.reviewedAt),
      updatedAt: Timestamp.now(),
    });
    logNoDueEvent('submission:update_success', { submissionId, status: updateData.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logNoDueEvent('submission:update_error', { submissionId, message }, 'error');
    console.error('Error updating submission:', error);
    throw new Error('Failed to update submission');
  }
}

/**
 * Resubmit a rejected submission with updated comments and optional new PDF
 */
export async function resubmitSubmission(
  submissionId: string,
  studentId: string,
  data: { comments: string }
): Promise<void> {
  try {
    logNoDueEvent('submission:resubmit_start', { submissionId, studentId });
    const submissionRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);

    await updateDoc(submissionRef, {
      status: 'resubmitted',
      studentComments: data.comments,
      resubmittedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    logNoDueEvent('submission:resubmit_success', { submissionId, studentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logNoDueEvent('submission:resubmit_error', { submissionId, studentId, message }, 'error');
    console.error('Error resubmitting submission:', error);
    throw new Error('Failed to resubmit submission');
  }
}

/**
 * Get all teachers for dropdown selection
 */
export async function getAllTeachers(): Promise<Array<{id: string, name: string, email: string, dept: string}>> {
  try {
    logNoDueEvent('teachers:fetch_start');
    const querySnapshot = await getDocs(collection(db, 'teachers'));
    const teachers: Array<{id: string, name: string, email: string, dept: string}> = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      teachers.push({
        id: doc.id,
        name: data.name,
        email: data.email,
        dept: data.dept || '',
      });
    });
    
    const ordered = teachers.sort((a, b) => a.name.localeCompare(b.name));
    logNoDueEvent('teachers:fetch_success', { count: ordered.length });
    return ordered;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logNoDueEvent('teachers:fetch_error', { message }, 'error');
    console.error('Error getting teachers:', error);
    throw new Error('Failed to fetch teachers');
  }
}
