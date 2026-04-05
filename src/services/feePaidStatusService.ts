/**
 * Fee Paid Status Service
 * 
 * Handles fee paid status uploads and queries for students
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export interface FeePaidStatus {
  usn: string;
  departmentId: string;
  feePaid: boolean | null; // null means no record found
  uploadedAt?: string;
}

/**
 * Upload fee paid status from Excel file
 * Excel should have columns: USN, Fee Paid (Yes/No)
 */
export async function uploadFeePaidStatus(
  file: File,
  departmentId: string,
  adminId: string
): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
  errors: string[];
  message: string;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('department_id', departmentId);
    formData.append('admin_id', adminId);

    const response = await fetch(`${BACKEND_URL}/api/fee-paid-status/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Fee paid status uploaded:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Error uploading fee paid status:', error);
    throw error;
  }
}

/**
 * Get fee paid status for a student
 */
export async function getFeePaidStatus(
  usn: string,
  departmentId: string
): Promise<FeePaidStatus> {
  try {
    console.log(`[FEE_STATUS] Fetching fee status for USN: ${usn}, Department: ${departmentId}`);
    const url = `${BACKEND_URL}/api/fee-paid-status/${usn}/${departmentId}`;
    console.log(`[FEE_STATUS] URL: ${url}`);
    
    const response = await fetch(url);
    
    console.log(`[FEE_STATUS] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FEE_STATUS] HTTP Error ${response.status}: ${errorText}`);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      } catch (e) {
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    }

    const data = await response.json();
    console.log(`[FEE_STATUS] ✅ Fee paid status fetched:`, data);
    return data;
  } catch (error: any) {
    console.error(`[FEE_STATUS] ❌ Error fetching fee paid status:`, error);
    return {
      usn,
      departmentId,
      feePaid: null,
    };
  }
}
