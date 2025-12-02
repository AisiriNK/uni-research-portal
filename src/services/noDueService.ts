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

const SUBMISSIONS_COLLECTION = 'noDueSubmissions';

/**
 * Upload PDF file to Firebase Storage
 */
export async function uploadSubmissionPDF(file: File, studentId: string): Promise<{url: string, name: string}> {
  const timestamp = Date.now();
  const fileName = `${studentId}_${timestamp}_${file.name}`;
  const storageRef = ref(storage, `no-due-submissions/${studentId}/${fileName}`);
  
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  
  return { url, name: file.name };
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
    return docRef.id;
  } catch (error) {
    console.error('Error creating submission:', error);
    throw new Error('Failed to create submission');
  }
}

/**
 * Get all submissions for a student
 */
export async function getStudentSubmissions(studentId: string): Promise<NoDueSubmission[]> {
  try {
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
      } as NoDueSubmission);
    });
    
    // Sort in memory instead of using orderBy (avoids index requirement)
    return submissions.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA; // desc order
    });
  } catch (error) {
    console.error('Error getting student submissions:', error);
    throw new Error('Failed to fetch submissions');
  }
}

/**
 * Get all submissions for a teacher
 */
export async function getTeacherSubmissions(teacherId: string): Promise<NoDueSubmission[]> {
  try {
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
      } as NoDueSubmission);
    });
    
    // Sort in memory instead of using orderBy (avoids index requirement)
    return submissions.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA; // desc order
    });
  } catch (error) {
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
    const submissionRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    
    await updateDoc(submissionRef, {
      status: updateData.status,
      teacherComments: updateData.teacherComments || '',
      reviewedAt: Timestamp.fromDate(updateData.reviewedAt),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating submission:', error);
    throw new Error('Failed to update submission');
  }
}

/**
 * Get all teachers for dropdown selection
 */
export async function getAllTeachers(): Promise<Array<{id: string, name: string, email: string, dept: string}>> {
  try {
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
    
    return teachers.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error getting teachers:', error);
    throw new Error('Failed to fetch teachers');
  }
}
