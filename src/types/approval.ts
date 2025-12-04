// No-Due Approval Types

export type ApprovalCategory = 
  | 'subject_teacher'
  | 'library'
  | 'sports'
  | 'hostel'
  | 'accounts'
  | 'placement'
  | 'certificate'
  | 'mentor'
  | 'hod'
  | 'other';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  
  // Student info
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRegNo: string;
  studentDept: string;
  studentBranch: string;
  studentYear: string;
  
  // Approver (teacher) info
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherDept: string;
  
  // Request details
  category: ApprovalCategory;
  categoryLabel: string; // e.g., "Data Structures - CSE301"
  comments?: string; // Student's comments/reason
  
  // Status
  status: ApprovalStatus;
  rejectionReason?: string;
  isResubmitted?: boolean;
  resubmissionCount?: number;
  originalRequestId?: string;
  
  // Timestamps
  requestedAt: Date;
  respondedAt?: Date;
  resubmittedAt?: Date;
  
  // Session info (for tracking which batch)
  academicYear: string; // e.g., "2024-2025"
  semester: string; // e.g., "8"
}

export interface CreateApprovalRequestData {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherDept: string;
  category: ApprovalCategory;
  categoryLabel: string;
  comments?: string;
  academicYear: string;
  semester: string;
}

export interface UpdateApprovalData {
  status: ApprovalStatus;
  rejectionReason?: string;
  respondedAt: Date;
}

export interface NoDueCertificateData {
  studentName: string;
  studentRegNo: string;
  studentDept: string;
  studentBranch: string;
  studentYear: string;
  academicYear: string;
  semester: string;
  approvals: Array<{
    category: string;
    teacherName: string;
    approvedAt: Date;
  }>;
  generatedAt: Date;
}

export const APPROVAL_CATEGORIES: Record<ApprovalCategory, string> = {
  subject_teacher: 'Subject Teacher',
  library: 'Library',
  sports: 'Sports Department',
  hostel: 'Hostel',
  accounts: 'Accounts/Finance',
  placement: 'Training & Placement',
  certificate: 'Certificate Section',
  mentor: 'Mentor/Class Advisor',
  hod: 'Head of Department',
  other: 'Other',
};
