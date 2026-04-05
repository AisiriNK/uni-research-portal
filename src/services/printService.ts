import { PrintRequest, CreatePrintRequestData, UpdatePrintStatusData } from '@/types/print';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

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
    const formData = new FormData();
    formData.append('student_id', studentData.id);
    formData.append('student_name', studentData.name);
    formData.append('student_reg_no', studentData.regNo);
    formData.append('student_dept', studentData.dept);
    formData.append('student_email', studentData.email);
    formData.append('submission_id', requestData.submissionId);
    formData.append('submission_title', requestData.submissionTitle);
    formData.append('pdf_url', requestData.pdfUrl);
    formData.append('pdf_name', requestData.pdfName);
    formData.append('copies', String(requestData.printOptions.copies));
    formData.append('color_mode', requestData.printOptions.colorMode);
    formData.append('sides', requestData.printOptions.sides);
    
    const response = await fetch(`${BACKEND_URL}/api/print-requests/create`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const result = await response.json();
    return result.requestId;
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
    const response = await fetch(
      `${BACKEND_URL}/api/print-requests/student/${studentId}`
    );
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const result = await response.json();
    return (result.printRequests || []).map((req: any) => ({
      ...req,
      createdAt: req.createdAt ? new Date(req.createdAt) : undefined,
      updatedAt: req.updatedAt ? new Date(req.updatedAt) : undefined,
      completedAt: req.completedAt ? new Date(req.completedAt) : undefined,
    }));
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
    const response = await fetch(
      `${BACKEND_URL}/api/print-requests/submission/${submissionId}`
    );
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const result = await response.json();
    const printRequest = result.printRequest;
    
    if (!printRequest) {
      return null;
    }
    
    return {
      ...printRequest,
      createdAt: printRequest.createdAt ? new Date(printRequest.createdAt) : undefined,
      updatedAt: printRequest.updatedAt ? new Date(printRequest.updatedAt) : undefined,
      completedAt: printRequest.completedAt ? new Date(printRequest.completedAt) : undefined,
    };
  } catch (error) {
    console.error('Error getting print request by submission:', error);
    throw new Error('Failed to fetch print request');
  }
}

/**
 * Get all print requests (for reprography admin)
 */
export async function getAllPrintRequests(statusFilter?: string): Promise<PrintRequest[]> {
  try {
    const url = new URL(`${BACKEND_URL}/api/print-requests/all`);
    if (statusFilter) {
      url.searchParams.append('status', statusFilter);
    }
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const result = await response.json();
    return (result.printRequests || []).map((req: any) => ({
      ...req,
      createdAt: req.createdAt ? new Date(req.createdAt) : undefined,
      updatedAt: req.updatedAt ? new Date(req.updatedAt) : undefined,
      completedAt: req.completedAt ? new Date(req.completedAt) : undefined,
    }));
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
    const formData = new FormData();
    formData.append('status', updateData.status);
    formData.append('processed_by', updateData.processedBy);
    if (updateData.adminNotes) {
      formData.append('admin_notes', updateData.adminNotes);
    }
    
    const response = await fetch(`${BACKEND_URL}/api/print-requests/${requestId}/status`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
  } catch (error) {
    console.error('Error updating print request:', error);
    throw new Error('Failed to update print request');
  }
}
