/**
 * Course Feedback Tracking Service
 * 
 * Handles upload of course feedback Excel files and tracking of feedback completion
 * for students across subjects.
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { CourseFeedbackTracking, SubjectFeedbackStatus } from '@/types/schema';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/**
 * Interface for parsed Excel data
 */
export interface FeedbackExcelRow {
  usn: string;
  allFeedbackCompleted: boolean; // yes/no in Excel -> boolean
}

/**
 * Parse course feedback Excel file
 * Expected columns: USN, Course Feedback Completed (Yes/No)
 * 
 * Note: Backend handles Excel parsing for better compatibility
 */
export async function parseFeedbackExcel(file: File): Promise<FeedbackExcelRow[]> {
  try {
    // Send to backend for parsing (safer approach)
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${BACKEND_URL}/api/feedback/parse-excel`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to parse Excel file');
    }

    const data = await response.json();
    return data.feedbackData || [];
  } catch (error) {
    console.error('Error parsing Excel:', error);
    throw new Error('Failed to parse Excel file. Ensure it has columns: USN, Course Feedback Completed');
  }
}

/**
 * Upload course feedback data to Firestore
 */
export async function uploadCourseFeedback(
  file: File,
  departmentId: string,
  semesterNumber: number,
  academicYear: string,
  adminId: string
): Promise<{ uploaded: number; failed: number; errors: string[] }> {
  console.log('[COURSE_FEEDBACK] Starting uploadCourseFeedback operation', {
    departmentId,
    semesterNumber,
    academicYear,
    adminId,
    fileName: file.name,
  });

  const formData = new FormData();
  formData.append('department_id', departmentId);
  formData.append('semester_number', String(semesterNumber));
  formData.append('academic_year', academicYear);
  formData.append('admin_id', adminId);
  formData.append('file', file);

  const response = await fetch(`${BACKEND_URL}/api/feedback/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Error uploading feedback file:', {
      status: response.status,
      errorText,
    });
    throw new Error(errorText || 'Failed to upload course feedback');
  }

  const result = await response.json();
  console.log('[COURSE_FEEDBACK] Upload operation completed', {
    uploaded: result.uploaded,
    failed: result.failed,
    errorCount: result.errors?.length || 0,
    timestamp: new Date().toISOString(),
  });

  return {
    uploaded: result.uploaded || 0,
    failed: result.failed || 0,
    errors: result.errors || [],
  };
}

/**
 * Get feedback status for a student for a specific semester
 */
export async function getStudentFeedbackStatus(
  usn: string,
  departmentId: string,
  semesterNumber: number,
  academicYear: string
): Promise<CourseFeedbackTracking | null> {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  
  console.log('[COURSE_FEEDBACK] Fetching feedback status from backend', {
    usn,
    departmentId,
    semesterNumber,
    academicYear,
  });

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/feedback/student/${usn}/${departmentId}/${semesterNumber}`
    );

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success && data.allFeedbackCompleted !== undefined) {
      console.log('✅ Feedback status found:', {
        usn,
        departmentId,
        semesterNumber,
        allFeedbackCompleted: data.allFeedbackCompleted,
        timestamp: new Date().toISOString(),
      });
      
      return {
        usn: data.usn,
        departmentId: data.departmentId,
        semesterNumber: data.semesterNumber,
        academicYear: data.academicYear || academicYear,
        allFeedbackCompleted: data.allFeedbackCompleted,
      } as CourseFeedbackTracking;
    }

    console.log('[COURSE_FEEDBACK] No feedback status found for', {
      usn,
      departmentId,
      semesterNumber,
      academicYear,
      timestamp: new Date().toISOString(),
    });
    return null;
  } catch (error) {
    console.error('❌ Error fetching feedback status:', {
      error,
      usn,
      departmentId,
      semesterNumber,
      academicYear,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

/**
 * Get subject-wise feedback status for a student
 * Compares curriculum subjects with completed feedback
 */
export async function getSubjectFeedbackStatus(
  usn: string,
  departmentId: string,
  semesterNumber: number,
  academicYear: string
): Promise<SubjectFeedbackStatus[]> {
  try {
    const { getDocs, query, where, collection } = await import('firebase/firestore');

    // Get curriculum for this semester
    const curriculumQuery = query(
      collection(db, 'curriculum'),
      where('departmentId', '==', departmentId),
      where('semesterNumber', '==', semesterNumber)
    );
    const curriculumSnap = await getDocs(curriculumQuery);
    const subjects = curriculumSnap.docs.map(doc => ({
      code: doc.id.split('_')[0], // Extract subject code from doc ID
      name: (doc.data() as any).subjectName,
      type: (doc.data() as any).subjectType || 'core',
    }));

    // Get feedback status
    const feedbackStatus = await getStudentFeedbackStatus(
      usn,
      departmentId,
      semesterNumber,
      academicYear
    );

    // Map subjects with feedback completion
    return subjects.map(subject => ({
      subjectCode: subject.code,
      subjectName: subject.name,
      type: subject.type,
      feedbackCompleted: feedbackStatus?.completedSubjects.includes(subject.code) ?? false,
    }));
  } catch (error) {
    console.error('Error getting subject feedback status:', error);
    return [];
  }
}

/**
 * Check if a student has completed feedback for ALL subjects
 */
export async function hasCompletedAllFeedback(
  usn: string,
  departmentId: string,
  semesterNumber: number,
  academicYear: string
): Promise<boolean> {
  try {
    const feedbackStatus = await getStudentFeedbackStatus(
      usn,
      departmentId,
      semesterNumber,
      academicYear
    );

    return feedbackStatus?.allFeedbackCompleted ?? false;
  } catch (error) {
    console.error('Error checking feedback completion:', error);
    return false;
  }
}

/**
 * Get students missing feedback for a subject
 */
export async function getStudentsMissingFeedback(
  departmentId: string,
  semesterNumber: number,
  academicYear: string,
  subjectCode?: string
): Promise<Array<{ usn: string; allFeedbackCompleted: boolean }>> {
  try {
    const { getDocs, query, where, collection } = await import('firebase/firestore');

    const feedbackQuery = query(
      collection(db, 'course_feedback_tracking'),
      where('departmentId', '==', departmentId),
      where('semesterNumber', '==', semesterNumber),
      where('academicYear', '==', academicYear),
      where('allFeedbackCompleted', '==', false)
    );

    const querySnap = await getDocs(feedbackQuery);
    return querySnap.docs.map(doc => {
      const data = doc.data() as CourseFeedbackTracking;
      return {
        usn: data.usn,
        allFeedbackCompleted: data.allFeedbackCompleted,
      };
    });
  } catch (error) {
    console.error('Error fetching students missing feedback:', error);
    return [];
  }
}

/**
 * Mark feedback as completed for specific subjects
 */
export async function updateSubjectFeedback(
  usn: string,
  departmentId: string,
  semesterNumber: number,
  academicYear: string,
  completedSubjectCodes: string[],
  totalSubjectsCount: number
): Promise<void> {
  console.log('[COURSE_FEEDBACK] Starting updateSubjectFeedback operation', {
    usn,
    departmentId,
    semesterNumber,
    academicYear,
    completedSubjectCount: completedSubjectCodes.length,
    totalSubjectsCount,
  });

  try {
    const docId = `${usn}_${departmentId}_${semesterNumber}_${academicYear}`;
    const { getDoc } = await import('firebase/firestore');

    console.log('[COURSE_FEEDBACK] Fetching existing feedback document:', docId);
    // Get existing document
    const docSnap = await getDoc(doc(db, 'course_feedback_tracking', docId));
    let existingData: CourseFeedbackTracking | null = null;

    if (docSnap.exists()) {
      existingData = docSnap.data() as CourseFeedbackTracking;
      console.log('[COURSE_FEEDBACK] Existing document found:', {
        usn,
        currentStatus: existingData.allFeedbackCompleted,
        currentCompletedCount: existingData.completedSubjects.length,
      });
    } else {
      console.log('[COURSE_FEEDBACK] No existing document found, creating new');
    }

    const allSubjectsCompleted = completedSubjectCodes.length === totalSubjectsCount;

    console.log('[COURSE_FEEDBACK] Calculating feedback completion status', {
      completedSubjectCount: completedSubjectCodes.length,
      totalSubjectsCount,
      allSubjectsCompleted,
    });

    const updatedData: CourseFeedbackTracking = {
      usn,
      departmentId,
      semesterNumber,
      academicYear,
      allFeedbackCompleted: allSubjectsCompleted,
      completedSubjects: completedSubjectCodes,
      totalSubjects: totalSubjectsCount,
      uploadedAt: existingData?.uploadedAt ?? (serverTimestamp() as Timestamp),
      uploadedBy: existingData?.uploadedBy ?? 'system',
      lastUpdated: serverTimestamp() as Timestamp,
    };

    console.log('[COURSE_FEEDBACK] Writing updated feedback document to Firestore');
    await setDoc(doc(db, 'course_feedback_tracking', docId), updatedData);
    
    console.log('✅ Subject feedback updated successfully:', {
      usn,
      departmentId,
      semesterNumber,
      completedSubjects: completedSubjectCodes,
      allFeedbackCompleted: allSubjectsCompleted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error updating subject feedback:', {
      error,
      usn,
      departmentId,
      semesterNumber,
      completedSubjectCodes,
      timestamp: new Date().toISOString(),
    });
    throw new Error('Failed to update feedback status');
  }
}
