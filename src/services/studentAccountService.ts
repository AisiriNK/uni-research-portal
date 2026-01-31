/**
 * Student Account Creation Service (Admin Only)
 * 
 * Since students cannot sign up themselves, this service provides
 * admin functions to create student accounts with USN+DOB authentication.
 * 
 * IMPORTANT: Only department admins should have access to these functions.
 */

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { Student } from '@/types/schema';

/**
 * Creates a new student account (Admin only)
 * 
 * This function:
 * 1. Creates the student document in Firestore (students collection)
 * 2. Creates a Firebase Auth account using generated email (usn@university.edu) and DOB as password
 * 3. Links the Auth account to the student profile via users collection
 * 
 * @param studentData - Complete student information including DOB
 * @returns The created student's USN
 */
export async function createStudentAccount(studentData: {
  usn: string;
  name: string;
  dateOfBirth: string;        // YYYY-MM-DD format
  departmentId: string;
  batchYear: number;
  section: string;
  mentorEmployeeId: string;
  email?: string;             // Optional, will auto-generate if not provided
}): Promise<string> {
  try {
    const { usn, name, dateOfBirth, departmentId, batchYear, section, mentorEmployeeId } = studentData;
    
    // Validation
    if (!usn || !name || !dateOfBirth || !departmentId || !batchYear || !section || !mentorEmployeeId) {
      throw new Error('All student fields are required');
    }
    
    // Validate DOB format (YYYY-MM-DD)
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dateOfBirth)) {
      throw new Error('Date of Birth must be in YYYY-MM-DD format');
    }
    
    // Check if student already exists
    const studentRef = doc(db, 'students', usn);
    const studentSnap = await getDoc(studentRef);
    
    if (studentSnap.exists()) {
      throw new Error(`Student with USN ${usn} already exists`);
    }
    
    // Generate email (usn@university.edu)
    const email = studentData.email || `${usn.toLowerCase()}@university.edu`;
    
    // Create Firebase Auth account with USN email and DOB as password
    const userCredential = await createUserWithEmailAndPassword(auth, email, dateOfBirth);
    const firebaseUser = userCredential.user;
    
    // Create student document
    const student: Student = {
      usn,
      name,
      dateOfBirth,
      email,
      departmentId,
      batchYear,
      section,
      mentorEmployeeId,
    };
    
    await setDoc(studentRef, {
      ...student,
      createdAt: serverTimestamp(),
    });
    
    // Create users reference document (links Firebase Auth to student profile)
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      email,
      role: 'student',
      profileId: usn,
      createdAt: serverTimestamp(),
    });
    
    return usn;
  } catch (error: any) {
    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(`Email already in use. Student may already have an account.`);
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Date of Birth must be at least 6 characters (YYYY-MM-DD format)');
    } else {
      throw new Error(error.message || 'Failed to create student account');
    }
  }
}

/**
 * Creates multiple student accounts in batch (Admin only)
 * 
 * @param students - Array of student data
 * @returns Object with success count and errors
 */
export async function createStudentAccountsBatch(students: Array<{
  usn: string;
  name: string;
  dateOfBirth: string;
  departmentId: string;
  batchYear: number;
  section: string;
  mentorEmployeeId: string;
  email?: string;
}>): Promise<{
  successCount: number;
  errors: Array<{ usn: string; error: string }>;
}> {
  let successCount = 0;
  const errors: Array<{ usn: string; error: string }> = [];
  
  for (const student of students) {
    try {
      await createStudentAccount(student);
      successCount++;
    } catch (error: any) {
      errors.push({
        usn: student.usn,
        error: error.message,
      });
    }
  }
  
  return { successCount, errors };
}

/**
 * Updates student's date of birth (Admin only)
 * Use this if a student forgets their DOB or it needs to be corrected
 * 
 * @param usn - Student's USN
 * @param newDOB - New date of birth (YYYY-MM-DD)
 */
export async function updateStudentDOB(usn: string, newDOB: string): Promise<void> {
  try {
    // Validate DOB format
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(newDOB)) {
      throw new Error('Date of Birth must be in YYYY-MM-DD format');
    }
    
    // Check if student exists
    const studentRef = doc(db, 'students', usn);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      throw new Error('Student not found');
    }
    
    // Update DOB in Firestore
    await setDoc(studentRef, { dateOfBirth: newDOB }, { merge: true });
    
    // Note: Firebase Auth password (DOB) would also need to be updated
    // This requires re-authentication or admin SDK on backend
    console.warn('Firebase Auth password not updated. Student should re-login with new DOB.');
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update Date of Birth');
  }
}

/**
 * Gets student by USN
 * 
 * @param usn - Student's USN
 * @returns Student data or null
 */
export async function getStudentByUSN(usn: string): Promise<Student | null> {
  try {
    const studentRef = doc(db, 'students', usn);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      return null;
    }
    
    return studentSnap.data() as Student;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch student');
  }
}

/**
 * Validates if a student exists and DOB matches
 * 
 * @param usn - Student's USN
 * @param dob - Date of Birth to verify
 * @returns true if student exists and DOB matches
 */
export async function validateStudentCredentials(usn: string, dob: string): Promise<boolean> {
  try {
    const student = await getStudentByUSN(usn);
    
    if (!student) {
      return false;
    }
    
    return student.dateOfBirth === dob;
  } catch (error) {
    return false;
  }
}
