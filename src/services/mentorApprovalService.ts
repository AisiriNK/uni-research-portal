/**
 * Mentor Approval Service
 * 
 * Handles the mentor approval stage after all teachers have approved no-due requests.
 * 
 * Note: Mentors are faculty members (role='faculty') assigned as class mentors.
 * They use the same Teacher Dashboard but see additional mentor-specific features.
 * 
 * Workflow:
 * 1. All teachers approve their respective clearances
 * 2. System automatically marks student as ready for mentor approval
 * 3. Mentor (faculty) views all clearances received by their mentees
 * 4. Mentor does final approval/rejection from Teacher Dashboard
 * 5. If approved → Goes to admin for hall ticket generation
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { NoDueRequest, Student } from '@/types/schema';

/**
 * Interface for clearance summary shown to mentor
 */
export interface ClearanceSummary {
  usn: string;
  studentName: string;
  departmentId: string;
  batchYear: number;
  semesterNumber: number;
  section: string;
  totalClearances: number;
  approvedClearances: number;
  pendingClearances: number;
  rejectedClearances: number;
  allApproved: boolean;
  readyForMentorApproval: boolean;
  clearanceDetails: Array<{
    referenceType: string;
    referenceId: string;
    teacherEmployeeId: string;
    status: string;
    approvedAt?: Date;
    rejectionReason?: string;
  }>;
}

/**
 * Gets all no-due requests for students mentored by a specific faculty member
 * 
 * This function is used by faculty members who are assigned as mentors.
 * It shows in the Teacher Dashboard when the logged-in faculty has students assigned to them.
 * 
 * @param mentorEmployeeId - Faculty member's employee ID
 * @returns Array of clearance summaries for all mentees
 */
export async function getMenteeClearances(
  mentorEmployeeId: string
): Promise<ClearanceSummary[]> {
  try {
    // Get all students assigned to this mentor
    const studentsQuery = query(
      collection(db, 'students'),
      where('mentorEmployeeId', '==', mentorEmployeeId)
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    if (studentsSnap.empty) {
      return [];
    }
    
    const summaries: ClearanceSummary[] = [];
    
    // For each mentee, get their clearance status
    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data() as Student;
      
      // Get all no-due requests for this student
      const requestsQuery = query(
        collection(db, 'no_due_requests'),
        where('usn', '==', student.usn)
      );
      const requestsSnap = await getDocs(requestsQuery);
      
      if (requestsSnap.empty) {
        continue; // Student hasn't generated no-due requests yet
      }
      
      const requests = requestsSnap.docs.map(doc => doc.data() as NoDueRequest);
      
      // Calculate clearance statistics
      const total = requests.length;
      const approved = requests.filter(r => r.status === 'approved').length;
      const pending = requests.filter(r => r.status === 'pending').length;
      const rejected = requests.filter(r => r.status === 'rejected').length;
      const allApproved = approved === total;
      
      // Check if ready for mentor approval (all approved + mentor request exists)
      const mentorRequest = requests.find(r => r.referenceType === 'mentor');
      const readyForMentorApproval = allApproved && mentorRequest !== undefined;
      
      // Prepare clearance details
      const clearanceDetails = requests.map(r => ({
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        teacherEmployeeId: r.teacherEmployeeId,
        status: r.status,
        approvedAt: r.approvedAt ? (r.approvedAt as Timestamp).toDate() : undefined,
        rejectionReason: r.rejectionReason,
      }));
      
      summaries.push({
        usn: student.usn,
        studentName: student.name,
        departmentId: student.departmentId,
        batchYear: student.batchYear,
        semesterNumber: requests[0]?.semesterNumber || 0,
        section: student.section,
        totalClearances: total,
        approvedClearances: approved,
        pendingClearances: pending,
        rejectedClearances: rejected,
        allApproved,
        readyForMentorApproval,
        clearanceDetails,
      });
    }
    
    return summaries;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch mentee clearances');
  }
}

/**
 * Checks if a student is ready for mentor approval
 * (All teacher clearances approved)
 * 
 * @param usn - Student's USN
 * @returns true if ready for mentor approval
 */
export async function isReadyForMentorApproval(usn: string): Promise<boolean> {
  try {
    const requestsQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn)
    );
    const requestsSnap = await getDocs(requestsQuery);
    
    if (requestsSnap.empty) {
      return false;
    }
    
    const requests = requestsSnap.docs.map(doc => doc.data() as NoDueRequest);
    
    // Check if all non-mentor requests are approved
    const nonMentorRequests = requests.filter(r => r.referenceType !== 'mentor');
    const allApproved = nonMentorRequests.every(r => r.status === 'approved');
    
    // Check if mentor request exists
    const mentorRequest = requests.find(r => r.referenceType === 'mentor');
    
    return allApproved && mentorRequest !== undefined;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to check mentor approval readiness');
  }
}

/**
 * Mentor approves all clearances for a student
 * 
 * @param usn - Student's USN
 * @param mentorEmployeeId - Mentor's employee ID (for verification)
 */
export async function mentorApprove(
  usn: string,
  mentorEmployeeId: string
): Promise<void> {
  try {
    // Verify student is assigned to this mentor
    const studentRef = doc(db, 'students', usn);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      throw new Error('Student not found');
    }
    
    const student = studentSnap.data() as Student;
    if (student.mentorEmployeeId !== mentorEmployeeId) {
      throw new Error('You are not the mentor for this student');
    }
    
    // Verify all clearances are approved
    const ready = await isReadyForMentorApproval(usn);
    if (!ready) {
      throw new Error('Not all clearances are approved yet');
    }
    
    // Update the mentor no-due request
    const requestsQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn),
      where('referenceType', '==', 'mentor')
    );
    const requestsSnap = await getDocs(requestsQuery);
    
    if (requestsSnap.empty) {
      throw new Error('Mentor clearance request not found');
    }
    
    // Update mentor request status
    const mentorRequestDoc = requestsSnap.docs[0];
    await updateDoc(doc(db, 'no_due_requests', mentorRequestDoc.id), {
      status: 'mentor_approved',
      mentorApprovalStatus: 'approved',
      mentorApprovedAt: serverTimestamp(),
    });
    
    // Update all other requests to indicate mentor approval stage complete
    const allRequestsQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn)
    );
    const allRequestsSnap = await getDocs(allRequestsQuery);
    
    for (const reqDoc of allRequestsSnap.docs) {
      if (reqDoc.id !== mentorRequestDoc.id) {
        await updateDoc(doc(db, 'no_due_requests', reqDoc.id), {
          mentorApprovalStatus: 'approved',
          mentorApprovedAt: serverTimestamp(),
        });
      }
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to approve as mentor');
  }
}

/**
 * Mentor rejects clearances for a student
 * 
 * @param usn - Student's USN
 * @param mentorEmployeeId - Mentor's employee ID (for verification)
 * @param reason - Reason for rejection
 */
export async function mentorReject(
  usn: string,
  mentorEmployeeId: string,
  reason: string
): Promise<void> {
  try {
    // Verify student is assigned to this mentor
    const studentRef = doc(db, 'students', usn);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      throw new Error('Student not found');
    }
    
    const student = studentSnap.data() as Student;
    if (student.mentorEmployeeId !== mentorEmployeeId) {
      throw new Error('You are not the mentor for this student');
    }
    
    // Update the mentor no-due request
    const requestsQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn),
      where('referenceType', '==', 'mentor')
    );
    const requestsSnap = await getDocs(requestsQuery);
    
    if (requestsSnap.empty) {
      throw new Error('Mentor clearance request not found');
    }
    
    // Update mentor request with rejection
    const mentorRequestDoc = requestsSnap.docs[0];
    await updateDoc(doc(db, 'no_due_requests', mentorRequestDoc.id), {
      status: 'mentor_rejected',
      mentorApprovalStatus: 'rejected',
      mentorApprovedAt: serverTimestamp(),
      mentorRejectionReason: reason,
    });
    
    // Update all other requests to indicate mentor rejection
    const allRequestsQuery = query(
      collection(db, 'no_due_requests'),
      where('usn', '==', usn)
    );
    const allRequestsSnap = await getDocs(allRequestsQuery);
    
    for (const reqDoc of allRequestsSnap.docs) {
      if (reqDoc.id !== mentorRequestDoc.id) {
        await updateDoc(doc(db, 'no_due_requests', reqDoc.id), {
          mentorApprovalStatus: 'rejected',
          mentorApprovedAt: serverTimestamp(),
          mentorRejectionReason: reason,
        });
      }
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to reject as mentor');
  }
}

/**
 * Gets students whose clearances are ready for mentor approval
 * 
 * @param mentorEmployeeId - Mentor's employee ID
 * @returns Array of students ready for mentor approval
 */
export async function getStudentsReadyForMentorApproval(
  mentorEmployeeId: string
): Promise<ClearanceSummary[]> {
  try {
    const allMentees = await getMenteeClearances(mentorEmployeeId);
    return allMentees.filter(mentee => mentee.readyForMentorApproval);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch students ready for approval');
  }
}

/**
 * Gets students whose clearances have been approved by mentor (ready for hall ticket)
 * 
 * @param departmentId - Department ID
 * @returns Array of students ready for hall ticket generation
 */
export async function getStudentsReadyForHallTicket(
  departmentId: string
): Promise<Array<{
  usn: string;
  studentName: string;
  semesterNumber: number;
  section: string;
  mentorApprovedAt: Date;
}>> {
  try {
    // Query all mentor-approved requests in department
    const requestsQuery = query(
      collection(db, 'no_due_requests'),
      where('departmentId', '==', departmentId),
      where('referenceType', '==', 'mentor'),
      where('mentorApprovalStatus', '==', 'approved'),
      where('hallTicketGenerated', '==', false)
    );
    const requestsSnap = await getDocs(requestsQuery);
    
    return requestsSnap.docs.map(doc => {
      const data = doc.data() as NoDueRequest;
      return {
        usn: data.usn,
        studentName: data.studentName,
        semesterNumber: data.semesterNumber,
        section: data.section,
        mentorApprovedAt: (data.mentorApprovedAt as Timestamp).toDate(),
      };
    });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch students ready for hall ticket');
  }
}
