// No-Due Clearance Types

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface NoDueSubmission {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentDept: string;
  studentRegNo: string;
  
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  
  pdfUrl: string;
  pdfName: string;
  
  metadata: {
    title: string;
    description: string;
    category: string; // e.g., "Library", "Hostel", "Department", etc.
  };
  
  status: SubmissionStatus;
  
  teacherComments?: string;
  reviewedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubmissionData {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  pdfFile: File;
  metadata: {
    title: string;
    description: string;
    category: string;
  };
}

export interface UpdateSubmissionData {
  status: SubmissionStatus;
  teacherComments?: string;
  reviewedAt: Date;
}
