import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  getDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ApprovalRequest, CreateApprovalRequestData, UpdateApprovalData } from '@/types/approval';

const APPROVALS_COLLECTION = 'noDueApprovals';

/**
 * Create a new approval request
 */
export async function createApprovalRequest(
  studentData: {
    id: string;
    name: string;
    email: string;
    regNo: string;
    dept: string;
    branch: string;
    year: string;
  },
  requestData: CreateApprovalRequestData
): Promise<string> {
  try {
    const approval = {
      studentId: studentData.id,
      studentName: studentData.name,
      studentEmail: studentData.email,
      studentRegNo: studentData.regNo,
      studentDept: studentData.dept,
      studentBranch: studentData.branch,
      studentYear: studentData.year,
      
      teacherId: requestData.teacherId,
      teacherName: requestData.teacherName,
      teacherEmail: requestData.teacherEmail,
      teacherDept: requestData.teacherDept,
      
      category: requestData.category,
      categoryLabel: requestData.categoryLabel,
      comments: requestData.comments || '',
      
      status: 'pending',
      
      academicYear: requestData.academicYear,
      semester: requestData.semester,
      
      requestedAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, APPROVALS_COLLECTION), approval);
    return docRef.id;
  } catch (error) {
    console.error('Error creating approval request:', error);
    throw new Error('Failed to create approval request');
  }
}

/**
 * Get all approval requests for a student
 */
export async function getStudentApprovals(studentId: string): Promise<ApprovalRequest[]> {
  try {
    const q = query(
      collection(db, APPROVALS_COLLECTION),
      where('studentId', '==', studentId)
    );
    
    const querySnapshot = await getDocs(q);
    const approvals: ApprovalRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      approvals.push({
        id: doc.id,
        ...data,
        requestedAt: data.requestedAt?.toDate(),
        respondedAt: data.respondedAt?.toDate(),
      } as ApprovalRequest);
    });
    
    // Sort by requested date (newest first)
    return approvals.sort((a, b) => {
      const dateA = a.requestedAt?.getTime() || 0;
      const dateB = b.requestedAt?.getTime() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting student approvals:', error);
    throw new Error('Failed to fetch approvals');
  }
}

/**
 * Get all approval requests for a teacher
 */
export async function getTeacherApprovals(teacherId: string): Promise<ApprovalRequest[]> {
  try {
    const q = query(
      collection(db, APPROVALS_COLLECTION),
      where('teacherId', '==', teacherId)
    );
    
    const querySnapshot = await getDocs(q);
    const approvals: ApprovalRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      approvals.push({
        id: doc.id,
        ...data,
        requestedAt: data.requestedAt?.toDate(),
        respondedAt: data.respondedAt?.toDate(),
      } as ApprovalRequest);
    });
    
    // Sort by requested date (newest first)
    return approvals.sort((a, b) => {
      const dateA = a.requestedAt?.getTime() || 0;
      const dateB = b.requestedAt?.getTime() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error getting teacher approvals:', error);
    throw new Error('Failed to fetch approvals');
  }
}

/**
 * Update approval status (approve/reject)
 */
export async function updateApprovalStatus(
  approvalId: string,
  updateData: UpdateApprovalData
): Promise<void> {
  try {
    const approvalRef = doc(db, APPROVALS_COLLECTION, approvalId);
    
    const update: any = {
      status: updateData.status,
      respondedAt: Timestamp.fromDate(updateData.respondedAt),
    };
    
    if (updateData.rejectionReason) {
      update.rejectionReason = updateData.rejectionReason;
    }
    
    await updateDoc(approvalRef, update);
  } catch (error) {
    console.error('Error updating approval:', error);
    throw new Error('Failed to update approval');
  }
}

/**
 * Check if all approvals are complete for a student
 */
export async function checkAllApprovalsComplete(studentId: string, academicYear: string, semester: string): Promise<boolean> {
  try {
    const approvals = await getStudentApprovals(studentId);
    const relevantApprovals = approvals.filter(
      a => a.academicYear === academicYear && a.semester === semester
    );
    
    if (relevantApprovals.length === 0) return false;
    
    return relevantApprovals.every(a => a.status === 'approved');
  } catch (error) {
    console.error('Error checking approvals:', error);
    return false;
  }
}

/**
 * Resubmit a rejected approval request with updated comments
 */
export async function resubmitApprovalRequest(
  approvalId: string,
  newComments: string
): Promise<void> {
  try {
    const approvalRef = doc(db, APPROVALS_COLLECTION, approvalId);
    const approvalSnap = await getDoc(approvalRef);
    
    if (!approvalSnap.exists()) {
      throw new Error('Approval request not found');
    }
    
    const currentData = approvalSnap.data();
    
    if (currentData.status !== 'rejected') {
      throw new Error('Only rejected requests can be resubmitted');
    }
    
    await updateDoc(approvalRef, {
      status: 'pending',
      comments: newComments,
      rejectionReason: null,
      respondedAt: null,
      isResubmitted: true,
      resubmissionCount: (currentData.resubmissionCount || 0) + 1,
      resubmittedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error resubmitting approval request:', error);
    throw error;
  }
}

/**
 * Get approved approvals for certificate generation
 */
export async function getApprovedApprovalsForCertificate(
  studentId: string,
  academicYear: string,
  semester: string
): Promise<ApprovalRequest[]> {
  try {
    const approvals = await getStudentApprovals(studentId);
    return approvals.filter(
      a => a.academicYear === academicYear && 
           a.semester === semester && 
           a.status === 'approved'
    );
  } catch (error) {
    console.error('Error getting approved approvals:', error);
    throw new Error('Failed to fetch approved approvals');
  }
}
