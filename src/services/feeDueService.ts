const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export type FeeDueEntry = {
  usn: string;
  name: string;
  nameKey: string;
  feeDue: number;
  status: 'paid' | 'due';
};

export type FeeDuePayload = {
  uploadedAt: string;
  total: number;
  entries: FeeDueEntry[];
};

export const normalizeStudentName = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

export async function fetchLatestFeeDues(): Promise<FeeDuePayload | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/fee-dues/latest`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as FeeDuePayload;
  } catch (error) {
    return null;
  }
}

export async function uploadFeeDueExcel(file: File): Promise<{ success: boolean; total: number }>
{
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BACKEND_URL}/api/fee-dues/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Upload failed');
  }

  return response.json();
}
