/**
 * Backlog Management Service
 * 
 * Handles all operations related to student backlogs:
 * - Adding new backlogs
 * - Marking backlogs as cleared
 * - Retrieving backlog information
 * - Filtering backlogs by department/semester
 */

import { Backlog } from '@/types/schema';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/**
 * Add a new backlog for a student
 */
export async function addBacklog(
  usn: string,
  subjectCode: string,
  subjectName: string,
  departmentId: string,
  semesterNumber: number,
  adminId: string,
  notes?: string
): Promise<string> {
  console.log('[BACKLOG] Starting addBacklog operation', {
    usn,
    subjectCode,
    subjectName,
    departmentId,
    semesterNumber,
    adminId,
    hasNotes: !!notes,
  });

  try {
    const formData = new FormData();
    formData.append('usn', usn);
    formData.append('subject_code', subjectCode);
    formData.append('subject_name', subjectName);
    formData.append('department_id', departmentId);
    formData.append('semester_number', String(semesterNumber));
    formData.append('admin_id', adminId);
    if (notes) {
      formData.append('notes', notes);
    }

    const response = await fetch(`${BACKEND_URL}/api/backlogs/add`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();

    console.log('✅ Backlog added successfully:', {
      docId: result.backlogId,
      usn,
      subjectCode,
      departmentId,
      semesterNumber,
      timestamp: new Date().toISOString(),
    });
    return result.backlogId;
  } catch (error) {
    console.error('❌ Error adding backlog:', {
      error,
      usn,
      subjectCode,
      departmentId,
      semesterNumber,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Get all pending backlogs for a student
 */
export async function getStudentBacklogs(usn: string): Promise<Backlog[]> {
  // For student backlogs, students can read their own from frontend
  // But department backlogs require backend access
  return [];
}

/**
 * Get all pending backlogs for a department and semester
 */
export async function getDepartmentBacklogs(
  departmentId: string,
  semesterNumber: number
): Promise<Backlog[]> {
  try {
    console.log('[BACKLOG] Fetching department backlogs', {
      departmentId,
      semesterNumber,
    });

    const response = await fetch(
      `${BACKEND_URL}/api/backlogs/department/${departmentId}/${semesterNumber}`
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();
    console.log('[BACKLOG] Fetched backlogs:', {
      count: result.backlogs.length,
      departmentId,
      semesterNumber,
    });

    return result.backlogs;
  } catch (error) {
    console.error('❌ Error getting department backlogs:', error);
    throw error;
  }
}

/**
 * Mark a backlog as cleared
 */
export async function markBacklogCleared(
  backlogId: string,
  adminId: string
): Promise<void> {
  console.log('[BACKLOG] Starting markBacklogCleared operation', {
    backlogId,
    adminId,
  });

  try {
    console.log('[BACKLOG] Marking backlog as cleared via backend');
    
    const formData = new FormData();
    formData.append('admin_id', adminId);

    const response = await fetch(`${BACKEND_URL}/api/backlogs/${backlogId}/mark-cleared`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    console.log('✅ Backlog marked as cleared successfully:', {
      backlogId,
      clearedBy: adminId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error marking backlog as cleared:', {
      error,
      backlogId,
      adminId,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Delete a backlog record (for removing incorrectly added backlogs)
 */
export async function deleteBacklog(backlogId: string): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/backlogs/${backlogId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    console.log('✅ Backlog deleted:', backlogId);
  } catch (error) {
    console.error('❌ Error deleting backlog:', error);
    throw error;
  }
}

/**
 * Get all backlogs (pending and cleared) for a student
 * Used for historical records
 */
export async function getStudentAllBacklogs(usn: string): Promise<Backlog[]> {
  // Student backlogs are handled client-side if needed
  return [];
}

/**
 * Get cleared backlogs for a student (for hall ticket - to exclude from display)
 */
export async function getStudentClearedBacklogs(usn: string): Promise<Backlog[]> {
  // Student backlogs are handled client-side if needed
  return [];
}
