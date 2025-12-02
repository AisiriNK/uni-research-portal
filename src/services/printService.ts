import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PrintRequest, CreatePrintRequestData, UpdatePrintStatusData } from '@/types/print';

const PRINT_REQUESTS_COLLECTION = 'printRequests';

/**
 * Create a new print request
 */
export async function createPrintRequest(
  studentData: {
    id: string;
    name: string;
    email: string;
    dept: string;
    regNo: string;
  },
  requestData: CreatePrintRequestData
): Promise<string> {
  try {
    const printRequest = {
      submissionId: requestData.submissionId,
      submissionTitle: requestData.submissionTitle,
      pdfUrl: requestData.pdfUrl,
      pdfName: requestData.pdfName,
      
      studentId: studentData.id,
      studentName: studentData.name,
      studentRegNo: studentData.regNo,
      studentDept: studentData.dept,
      studentEmail: studentData.email,
      
      printOptions: requestData.printOptions,
      
      status: 'pending',
      
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, PRINT_REQUESTS_COLLECTION), printRequest);
    return docRef.id;
  } catch (error) {
    console.error('Error creating print request:', error);
    throw new Error('Failed to create print request');
  }
}

/**
 * Get all print requests for a student
 */
export async function getStudentPrintRequests(studentId: string): Promise<PrintRequest[]> {
  try {
    const q = query(
      collection(db, PRINT_REQUESTS_COLLECTION),
      where('studentId', '==', studentId)
    );
    
    const querySnapshot = await getDocs(q);
    const requests: PrintRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      requests.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        completedAt: data.completedAt?.toDate(),
      } as PrintRequest);
    });
    
    // Sort by creation date (newest first)
    return requests.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting student print requests:', error);
    throw new Error('Failed to fetch print requests');
  }
}

/**
 * Get print request by submission ID (check if print already requested)
 */
export async function getPrintRequestBySubmission(submissionId: string): Promise<PrintRequest | null> {
  try {
    const q = query(
      collection(db, PRINT_REQUESTS_COLLECTION),
      where('submissionId', '==', submissionId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      completedAt: data.completedAt?.toDate(),
    } as PrintRequest;
  } catch (error) {
    console.error('Error getting print request by submission:', error);
    throw new Error('Failed to fetch print request');
  }
}

/**
 * Get all print requests (for reprography admin)
 */
export async function getAllPrintRequests(): Promise<PrintRequest[]> {
  try {
    const querySnapshot = await getDocs(collection(db, PRINT_REQUESTS_COLLECTION));
    const requests: PrintRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      requests.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        completedAt: data.completedAt?.toDate(),
      } as PrintRequest);
    });
    
    // Sort by creation date (newest first)
    return requests.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting all print requests:', error);
    throw new Error('Failed to fetch print requests');
  }
}

/**
 * Update print request status (for reprography admin)
 */
export async function updatePrintRequestStatus(
  requestId: string,
  updateData: UpdatePrintStatusData
): Promise<void> {
  try {
    const requestRef = doc(db, PRINT_REQUESTS_COLLECTION, requestId);
    
    const update: any = {
      status: updateData.status,
      processedBy: updateData.processedBy,
      updatedAt: Timestamp.now(),
    };
    
    if (updateData.adminNotes) {
      update.adminNotes = updateData.adminNotes;
    }
    
    if (updateData.status === 'completed' && updateData.completedAt) {
      update.completedAt = Timestamp.fromDate(updateData.completedAt);
    }
    
    await updateDoc(requestRef, update);
  } catch (error) {
    console.error('Error updating print request:', error);
    throw new Error('Failed to update print request');
  }
}
