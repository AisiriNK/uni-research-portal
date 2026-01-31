/**
 * User Type Definitions (Updated for No-Due Automation Schema)
 * 
 * CHANGES FROM PREVIOUS VERSION:
 * - Students now use 'usn' instead of 'regNo'
 * - Students have departmentId, batchYear, section, mentorEmployeeId
 * - Teachers use 'employeeId' instead of 'empId'
 * - Teachers have role (faculty/mentor/librarian/accounts/sports/admin)
 * - Admin is separate role (department_admin)
 * - Removed reprography_admin (use regular admin role)
 */

export type UserRole = 'student' | 'teacher' | 'department_admin' | 'admin' | 'reprography_admin';

export interface BaseUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

// Student interface matching Firebase schema
export interface Student extends BaseUser {
  role: 'student';
  usn: string;                    // Unique Student Number (replaces regNo)
  dateOfBirth: string;            // Date of Birth (YYYY-MM-DD) - used for login
  departmentId: string;           // Department code (replaces dept)
  batchYear: number;              // Year of admission
  section: string;                // Section (A, B, C, etc.)
  mentorEmployeeId: string;       // Assigned mentor
  currentSemester?: number;       // Computed dynamically
  
  // Legacy aliases for backward compatibility
  dept?: string;                  // Alias for departmentId
  regNo?: string;                 // Alias for usn
}

// Teacher interface matching Firebase schema
export interface Teacher extends BaseUser {
  role: 'teacher';
  employeeId: string;             // Employee ID (replaces empId)
  departmentId: string;           // Department or "institution"
  teacherRole: 'faculty' | 'mentor' | 'librarian' | 'accounts' | 'sports' | 'admin';
  
  // Legacy aliases for backward compatibility
  empId?: string;                 // Alias for employeeId
  dept?: string;                  // Alias for departmentId
}

// Department admin interface
export interface DepartmentAdmin extends BaseUser {
  role: 'department_admin';
  adminId: string;
  departmentId: string;           // Department they manage
  
  // Legacy aliases for backward compatibility
  dept?: string;                  // Alias for departmentId
}

export type User = Student | Teacher | DepartmentAdmin;

export interface UserContextType {
  user: User | null;
  userProfile: User | null;       // Alias for user, contains full profile data
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginStudent: (usn: string, dob: string) => Promise<void>; // Student login with USN+DOB
  signup: (userData: SignupData) => Promise<void>;
  logout: () => Promise<void>;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  
  // Student-specific fields
  usn?: string;
  dateOfBirth?: string;           // Required for students (YYYY-MM-DD)
  departmentId?: string;
  batchYear?: number;
  section?: string;
  mentorEmployeeId?: string;
  
  // Teacher-specific fields
  employeeId?: string;
  teacherRole?: 'faculty' | 'mentor' | 'librarian' | 'accounts' | 'sports' | 'admin';
  
  // Admin-specific fields
  adminId?: string;
  
  // Legacy fields (for backward compatibility)
  regNo?: string;                 // Maps to usn
  dept?: string;                  // Maps to departmentId
  empId?: string;                 // Maps to employeeId
  branch?: string;                // Deprecated
}
