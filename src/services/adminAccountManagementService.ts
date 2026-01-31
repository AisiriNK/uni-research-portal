/**
 * Admin Account Management Service
 * 
 * Allows department admins to create student and teacher accounts.
 * 
 * IMPORTANT: Only use these functions in admin-authenticated contexts.
 */

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth, db, firebaseConfig } from '@/config/firebase';

/**
 * Default temporary password for new accounts
 */
const DEFAULT_TEMP_PASSWORD = 'Temp@123456';

const SECONDARY_APP_NAME = 'AdminAccountCreator';
let secondaryAuthInstance: Auth | null = null;

function getSecondaryAuth(): Auth {
  if (secondaryAuthInstance) {
    return secondaryAuthInstance;
  }
  const existingApp = getApps().find((appInstance) => appInstance.name === SECONDARY_APP_NAME);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  secondaryAuthInstance = getAuth(secondaryApp);
  return secondaryAuthInstance;
}

// ============================================================================
// STUDENT ACCOUNT CREATION
// ============================================================================

export interface StudentAccountData {
  usn: string;
  name: string;
  dateOfBirth: string;        // YYYY-MM-DD format
  departmentId: string;
  batchYear: number;
  section: string;
  mentorEmployeeId: string;
  email?: string;             // Optional, will auto-generate if not provided
}

/**
 * Creates a single student account
 * 
 * @param studentData - Student information
 * @param adminId - Admin ID creating the account
 * @returns Created student's USN
 */
export async function createStudentAccount(
  studentData: StudentAccountData,
  adminId: string
): Promise<string> {
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
    
    // Generate or validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const providedEmail = studentData.email?.trim();
    const email = providedEmail ? providedEmail : `${usn.toLowerCase()}@university.edu`;
    if (providedEmail && !emailRegex.test(providedEmail)) {
      throw new Error('Invalid student email format');
    }
    
    // Create Firebase Auth account via secondary auth instance
    const secondaryAuth = getSecondaryAuth();
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, dateOfBirth);
    const firebaseUser = userCredential.user;
    
    // Create student document
    await setDoc(studentRef, {
      usn,
      name,
      dateOfBirth,
      email,
      departmentId,
      batchYear,
      section,
      mentorEmployeeId,
      createdAt: serverTimestamp(),
      createdBy: adminId,
    });
    
    // Create users reference document (links Firebase Auth to student profile)
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      email,
      role: 'student',
      profileId: usn,
      createdAt: serverTimestamp(),
      createdBy: adminId,
    });
    
    await signOut(secondaryAuth);
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
 * Creates multiple student accounts in batch
 * 
 * @param students - Array of student data
 * @param adminId - Admin ID creating the accounts
 * @returns Summary of created accounts and errors
 */
export async function createStudentAccountsBatch(
  students: StudentAccountData[],
  adminId: string
): Promise<{
  successCount: number;
  created: string[];
  errors: Array<{ usn: string; error: string }>;
}> {
  let successCount = 0;
  const created: string[] = [];
  const errors: Array<{ usn: string; error: string }> = [];
  
  for (const student of students) {
    try {
      const usn = await createStudentAccount(student, adminId);
      successCount++;
      created.push(usn);
    } catch (error: any) {
      errors.push({
        usn: student.usn,
        error: error.message,
      });
    }
  }
  
  return { successCount, created, errors };
}

// ============================================================================
// TEACHER ACCOUNT CREATION
// ============================================================================

export interface TeacherAccountData {
  employeeId: string;
  name: string;
  email: string;
  departmentId: string;
  teacherRole: 'faculty' | 'librarian' | 'accounts' | 'sports' | 'admin';
  temporaryPassword?: string; // Optional, uses default if not provided
}

/**
 * Creates a single teacher account with temporary password
 * using a secondary Firebase Auth instance so the current admin
 * session remains intact.
 * 
 * @param teacherData - Teacher information
 * @param adminId - Admin ID creating the account
 * @returns Created teacher's employee ID and temporary password
 */
export async function createTeacherAccount(
  teacherData: TeacherAccountData,
  adminId: string
): Promise<{ employeeId: string; temporaryPassword: string }> {
  try {
    const { employeeId, name, email, departmentId, teacherRole } = teacherData;
    
    // Validation
    if (!employeeId || !name || !email || !departmentId || !teacherRole) {
      throw new Error('All teacher fields are required');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    
    // Check if teacher already exists
    const teacherRef = doc(db, 'teachers', employeeId);
    const teacherSnap = await getDoc(teacherRef);
    
    if (teacherSnap.exists()) {
      throw new Error(`Teacher with Employee ID ${employeeId} already exists`);
    }
    
    // Use provided temporary password or default
    const temporaryPassword = teacherData.temporaryPassword || DEFAULT_TEMP_PASSWORD;
    
    // Create Firebase Auth account using secondary auth instance
    const secondaryAuth = getSecondaryAuth();
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, temporaryPassword);
    const firebaseUser = userCredential.user;
    
    // Create teacher document
    await setDoc(teacherRef, {
      employeeId,
      name,
      email,
      departmentId,
      role: teacherRole,
      uid: firebaseUser.uid,
      createdAt: serverTimestamp(),
      createdBy: adminId,
      passwordResetRequired: true,
    });
    
    // Link Firebase Auth user to teacher profile
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      email,
      role: 'teacher',
      profileId: employeeId,
      createdAt: serverTimestamp(),
      createdBy: adminId,
    });
    
    // Sign out from secondary auth to keep it clean
    await signOut(secondaryAuth);
    
    return { employeeId, temporaryPassword };
  } catch (error: any) {
    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(`Email already in use. Teacher may already have an account.`);
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters long');
    } else {
      throw new Error(error.message || 'Failed to create teacher account');
    }
  }
}

/**
 * Creates multiple teacher accounts in batch
 * 
 * @param teachers - Array of teacher data
 * @param adminId - Admin ID creating the accounts
 * @returns Summary of created accounts and errors
 */
export async function createTeacherAccountsBatch(
  teachers: TeacherAccountData[],
  adminId: string
): Promise<{
  successCount: number;
  created: Array<{ employeeId: string; email: string; temporaryPassword: string }>;
  errors: Array<{ employeeId: string; error: string }>;
}> {
  let successCount = 0;
  const created: Array<{ employeeId: string; email: string; temporaryPassword: string }> = [];
  const errors: Array<{ employeeId: string; error: string }> = [];
  
  for (const teacher of teachers) {
    try {
      const result = await createTeacherAccount(teacher, adminId);
      successCount++;
      created.push({
        employeeId: result.employeeId,
        email: teacher.email,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (error: any) {
      errors.push({
        employeeId: teacher.employeeId,
        error: error.message,
      });
    }
  }
  
  return { successCount, created, errors };
}

// ============================================================================
// ADMIN ACCOUNT CREATION
// ============================================================================

export interface AdminAccountData {
  adminId: string;
  name: string;
  email: string;
  departmentId: string;
  temporaryPassword?: string;
}

/**
 * Creates a department admin account using a secondary Firebase Auth instance
 * so the currently logged-in admin remains authenticated.
 * 
 * @param adminData - Admin information
 * @returns Created admin's ID and temporary password
 */
export async function createAdminAccount(
  adminData: AdminAccountData
): Promise<{ adminId: string; temporaryPassword: string }> {
  console.log('createAdminAccount called with:', adminData);
  try {
    const { adminId, name, email, departmentId } = adminData;
    
    // Validation
    if (!adminId || !name || !email || !departmentId) {
      console.error('Validation failed - missing fields');
      throw new Error('All admin fields are required');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email);
      throw new Error('Invalid email format');
    }
    
    console.log('Checking if admin exists...');
    // Check if admin already exists
    const adminRef = doc(db, 'admins', adminId);
    const adminSnap = await getDoc(adminRef);
    
    if (adminSnap.exists()) {
      console.error('Admin already exists:', adminId);
      throw new Error(`Admin with ID ${adminId} already exists`);
    }
    
    // Use provided temporary password or default
    const temporaryPassword = adminData.temporaryPassword || DEFAULT_TEMP_PASSWORD;
    
    console.log('Creating Firebase Auth user via secondary app...');
    const secondaryAuth = getSecondaryAuth();
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, temporaryPassword);
    const firebaseUser = userCredential.user;
    
    console.log('Creating admin document in Firestore...');
    await setDoc(adminRef, {
      adminId,
      name,
      email,
      departmentId,
      role: 'department_admin',
      uid: firebaseUser.uid,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || 'system',
      permissions: ['manage_students', 'manage_teachers', 'manage_curriculum', 'view_reports'],
    });
    
    // Link Firebase Auth user to admin profile
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      email,
      role: 'department_admin',
      profileId: adminId,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || 'system',
    });
    
    await signOut(secondaryAuth);
    console.log('Admin document created successfully');
    
    return { adminId, temporaryPassword };
  } catch (error: any) {
    console.error('Error in createAdminAccount:', error);
    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(`Email already in use. Admin may already have an account.`);
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters long');
    } else {
      throw new Error(error.message || 'Failed to create admin account');
    }
  }
}

// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================

/**
 * Sends password reset email to teacher
 * 
 * @param email - Teacher's email address
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    } else {
      throw new Error(error.message || 'Failed to send password reset email');
    }
  }
}

/**
 * Updates student's date of birth (admin only)
 * Use this if a student forgets their DOB or it needs correction
 * 
 * @param usn - Student's USN
 * @param newDOB - New date of birth (YYYY-MM-DD)
 * @param adminId - Admin ID making the change
 */
export async function updateStudentDOB(
  usn: string,
  newDOB: string,
  adminId: string
): Promise<void> {
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
    await setDoc(studentRef, { 
      dateOfBirth: newDOB,
      updatedAt: serverTimestamp(),
      updatedBy: adminId,
    }, { merge: true });
    
    console.warn('⚠️ Firebase Auth password not updated. Student should re-login with new DOB.');
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update Date of Birth');
  }
}

// ============================================================================
// ACCOUNT VERIFICATION
// ============================================================================

/**
 * Checks if a student account exists
 * 
 * @param usn - Student's USN
 * @returns true if account exists
 */
export async function checkStudentExists(usn: string): Promise<boolean> {
  try {
    const studentRef = doc(db, 'students', usn);
    const studentSnap = await getDoc(studentRef);
    return studentSnap.exists();
  } catch (error) {
    return false;
  }
}

/**
 * Checks if a teacher account exists
 * 
 * @param employeeId - Teacher's employee ID
 * @returns true if account exists
 */
export async function checkTeacherExists(employeeId: string): Promise<boolean> {
  try {
    const teacherRef = doc(db, 'teachers', employeeId);
    const teacherSnap = await getDoc(teacherRef);
    return teacherSnap.exists();
  } catch (error) {
    return false;
  }
}

/**
 * Gets all students in a department
 * 
 * @param departmentId - Department ID
 * @returns Array of student USNs
 */
export async function getDepartmentStudents(departmentId: string): Promise<string[]> {
  try {
    const studentsQuery = query(
      collection(db, 'students'),
      where('departmentId', '==', departmentId)
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    return studentsSnap.docs.map(doc => doc.id);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch department students');
  }
}

/**
 * Gets all teachers in a department
 * 
 * @param departmentId - Department ID
 * @returns Array of teacher employee IDs
 */
export async function getDepartmentTeachers(departmentId: string): Promise<string[]> {
  try {
    const teachersQuery = query(
      collection(db, 'teachers'),
      where('departmentId', '==', departmentId)
    );
    const teachersSnap = await getDocs(teachersQuery);
    
    return teachersSnap.docs.map(doc => doc.id);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch department teachers');
  }
}

// Export service object for convenience
export const adminAccountManagementService = {
  createStudentAccount,
  createTeacherAccount,
  createAdminAccount,
  getDepartmentStudents,
  getDepartmentTeachers,
};

export default adminAccountManagementService;
