// Print Request Types

export type PrintColorMode = 'bw' | 'color';
export type PrintSides = 'single' | 'double';
export type BindingType = 'none' | 'staple' | 'soft-bind' | 'spiral-bind';
export type PrintStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export interface PrintOptions {
  colorMode: PrintColorMode;
  sides: PrintSides;
  binding: BindingType;
  copies: number;
  additionalNotes?: string;
}

export interface PrintRequest {
  id: string;
  
  // Submission reference
  submissionId: string;
  submissionTitle: string;
  pdfUrl: string;
  pdfName: string;
  
  // Student info
  studentId: string;
  studentName: string;
  studentRegNo: string;
  studentDept: string;
  studentEmail: string;
  
  // Print options
  printOptions: PrintOptions;
  
  // Status tracking
  status: PrintStatus;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Admin info (when status changes)
  processedBy?: string;
  adminNotes?: string;
}

export interface CreatePrintRequestData {
  submissionId: string;
  submissionTitle: string;
  pdfUrl: string;
  pdfName: string;
  printOptions: PrintOptions;
}

export interface UpdatePrintStatusData {
  status: PrintStatus;
  adminNotes?: string;
  processedBy: string;
  completedAt?: Date;
}
