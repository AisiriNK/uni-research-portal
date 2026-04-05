import { API_CONFIG, buildApiUrl } from '@/config/api';

export interface DepartmentCertificate {
  usn: string;
  studentName: string;
  certificateName: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
  fileType: string;
  downloadUrl: string;
}

/**
 * Get all certificates for students in a department
 */
export async function getDepartmentCertificates(
  departmentId: string
): Promise<DepartmentCertificate[]> {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/certificates/department/${departmentId}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.certificates || [];
  } catch (error) {
    console.error('Error fetching department certificates:', error);
    throw error;
  }
}

/**
 * Download a certificate file
 */
export async function downloadDepartmentCertificate(downloadUrl: string): Promise<void> {
  try {
    // Convert relative URLs to absolute
    const url = downloadUrl.startsWith('http') 
      ? downloadUrl 
      : `${API_CONFIG.BASE_URL}${downloadUrl}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download certificate: ${response.status}`);
    }

    // Get filename from content-disposition or URL
    const contentDisposition = response.headers.get('content-disposition');
    let filename = 'certificate';

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    } else {
      // Extract from URL
      const urlParts = downloadUrl.split('/');
      filename = urlParts[urlParts.length - 1];
    }

    // Create blob and download
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Error downloading certificate:', error);
    throw error;
  }
}
