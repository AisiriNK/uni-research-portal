/**
 * Firebase Schema Type Definitions for No-Due Automation System
 * 
 * This file defines ALL Firestore collections and their exact structure
 * as specified in the no-due automation requirements.
 * 
 * IMPORTANT: Do NOT modify collection names or required fields without
 * updating the corresponding Firestore security rules.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// COLLECTION: students
// Document ID: usn
// ============================================================================

export interface Student {
  usn: string;                    // Unique Student Number (Document ID)
  name: string;                   // Student full name
  dateOfBirth: string;            // Date of Birth (YYYY-MM-DD) - used for login authentication
  departmentId: string;           // Department code (e.g., "CS", "EC", "ME")
  batchYear: number;              // Year of admission (e.g., 2021, 2022)
  section: string;                // Section (e.g., "A", "B", "C")
  email: string;                  // Student email
  mentorEmployeeId: string;       // Mentor's employee ID (ONE mentor per student)
}

// ============================================================================
// COLLECTION: teachers
// Document ID: employeeId
// ============================================================================

export type TeacherRole = 
  | 'faculty'          // Faculty member (can be subject teacher AND/OR mentor)
  | 'librarian'        // Library staff
  | 'accounts'         // Accounts department
  | 'sports'           // Sports coordinator
  | 'admin';           // Administrative staff

export interface Teacher {
  employeeId: string;             // Unique Employee ID (Document ID)
  name: string;                   // Teacher/Staff full name
  designation?: string;           // Job title/designation (e.g., Assistant Professor)
  departmentId: string;           // Department code OR "institution" for institution-wide roles
  email: string;                  // Email address
  role: TeacherRole;              // Primary role
  // Note: Faculty members can be both subject teachers AND mentors
  // Mentor assignment is tracked in Student.mentorEmployeeId
}

// ============================================================================
// COLLECTION: academic_context
// Document ID: "current" (singleton)
// ============================================================================

export type SemesterType = 'odd' | 'even';

export interface AcademicContext {
  academicYear: string;           // e.g., "2025-26"
  semesterType: SemesterType;     // "odd" or "even"
}

// ============================================================================
// COLLECTION: curriculum
// Document ID: {departmentId}_{batchYear}_{semesterNumber}_{subjectCode}
// Purpose: Batch-specific curriculum (subjects can shift semesters across batches)
// ============================================================================

export type SubjectType = 'core' | 'open_elective';

export interface Curriculum {
  departmentId: string;           // Department code
  batchYear: number;              // Batch year this applies to
  semesterNumber: number;         // Semester (1-8)
  subjectCode: string;            // Subject code (e.g., "CS501", "CS9OE1")
  subjectName: string;            // Full subject name
  subjectType: SubjectType;       // "core" or "open_elective"
}

// ============================================================================
// COLLECTION: core_subject_teacher_mapping
// Document ID: {departmentId}_{batchYear}_{semester}_{section}_{subjectCode}
// Purpose: Section-wise teacher mapping for core subjects
// ============================================================================

export interface CoreSubjectTeacherMapping {
  departmentId: string;           // Department code
  batchYear: number;              // Batch year
  semesterNumber: number;         // Semester
  section: string;                // Section (A, B, C, etc.)
  subjectCode: string;            // Core subject code
  teacherEmployeeId: string;      // Assigned teacher's employee ID
}

// ============================================================================
// COLLECTION: open_elective_offerings
// Document ID: {departmentId}_{batchYear}_{semester}_{subjectCode}
// Purpose: Open electives offered by department with assigned teacher
// ============================================================================

export interface OpenElectiveOffering {
  departmentId: string;           // Offering department
  batchYear: number;              // Batch year
  semesterNumber: number;         // Semester
  subjectCode: string;            // Elective subject code
  subjectName: string;            // Full subject name
  teacherEmployeeId: string;      // Teacher offering this elective
}

// ============================================================================
// COLLECTION: student_elective_choice
// Document ID: {usn}_{semesterNumber}
// Purpose: Stores elective chosen by student
// ============================================================================

export interface StudentElectiveChoice {
  usn: string;                    // Student USN
  batchYear: number;              // Student's batch year
  semesterNumber: number;         // Semester
  subjectCode: string;            // Chosen elective subject code
}

// ============================================================================
// COLLECTION: common_clearance_types
// Document IDs: "library", "fees", "sports", "certificate", "mentor"
// Purpose: Defines non-academic no-due categories
// ============================================================================

export type CommonClearanceTypeId = 
  | 'library' 
  | 'fees' 
  | 'sports' 
  | 'certificate' 
  | 'mentor';

export interface CommonClearanceType {
  clearanceTypeId: CommonClearanceTypeId;
  clearanceName: string;          // Display name (e.g., "Library Clearance")
  description: string;            // Description of what needs clearance
}

// ============================================================================
// COLLECTION: common_clearance_mapping
// Document ID: {departmentId}_{clearanceTypeId} (scoped) or {clearanceTypeId} (legacy)
// Purpose: Maps common clearances to responsible staff
// NOTE: Librarian is COMMON for ALL departments
// NOTE: Mentor clearance must NOT be mapped here (uses student.mentorEmployeeId)
// ============================================================================

export interface CommonClearanceMapping {
  clearanceTypeId: string;        // "library", "fees", "sports", "certificate"
  teacherEmployeeId: string;      // Responsible staff employee ID
  departmentId?: string | null;   // Optional department scope
}

// ============================================================================
// COLLECTION: no_due_requests
// Document ID: ND_{usn}_{referenceId}
// Purpose: Tracks every clearance request
// ============================================================================

export type ReferenceType = 
  | 'core_subject'
  | 'open_elective'
  | 'common_clearance'
  | 'mentor';

export type NoDueStatus = 
  | 'pending'                    // Waiting for teacher approval
  | 'resubmitted'                // Student resubmitted after rejection
  | 'approved'                   // Teacher approved
  | 'rejected'                   // Teacher rejected
  | 'pending_mentor_approval'    // All teachers approved, waiting for mentor
  | 'mentor_approved'            // Mentor approved
  | 'mentor_rejected'            // Mentor rejected
  | 'completed';                 // Hall ticket generated

export interface NoDueRequest {
  usn: string;                    // Student USN
  studentName: string;            // Student name (denormalized for display)
  departmentId: string;           // Student's department
  batchYear: number;              // Student's batch year
  semesterNumber: number;         // Current semester
  section: string;                // Student's section
  
  referenceType: ReferenceType;   // Type of clearance
  referenceId: string;            // Subject code, clearance type, or "mentor"
  
  teacherEmployeeId: string;      // Assigned teacher/staff
  
  status: NoDueStatus;            // Request status
  requestedAt: Timestamp;         // When request was created
  approvedAt?: Timestamp;         // When approved/rejected (optional)
  rejectionReason?: string;       // Reason for rejection (optional)
  studentResubmissionComment?: string; // Student resubmission note (optional)
  resubmittedAt?: Timestamp;       // When student resubmitted (optional)
  
  // Mentor approval stage (after all teachers approve)
  mentorApprovalStatus?: 'pending' | 'approved' | 'rejected';  // Mentor's decision
  mentorApprovedAt?: Timestamp;   // When mentor approved/rejected
  mentorRejectionReason?: string; // Reason if mentor rejects
  
  // Hall ticket generation (after mentor approval)
  hallTicketGenerated?: boolean;  // Whether hall ticket was generated
  hallTicketGeneratedAt?: Timestamp; // When hall ticket was generated
  hallTicketGeneratedBy?: string; // Admin who generated hall ticket
}

// ============================================================================
// COLLECTION: admins
// Document ID: {adminId}
// Purpose: Department-wise admin login
// ============================================================================

export interface Admin {
  adminId: string;                // Admin ID (Document ID)
  departmentId: string;           // Department they manage
  role: 'department_admin';       // Fixed role
  email: string;                  // Admin email
}

// ============================================================================
// HELPER TYPES FOR FRONTEND OPERATIONS
// ============================================================================

/**
 * Computes current semester based on batch year and academic context
 * Formula: (currentYear - batchYear) * 2 + (semesterType === 'odd' ? 1 : 2)
 */
export interface SemesterCalculation {
  semesterNumber: number;         // Computed semester (1-8)
  academicYear: string;           // Current academic year
  semesterType: SemesterType;     // Current semester type
}

/**
 * Complete student profile with computed semester
 */
export interface StudentProfile extends Student {
  currentSemester: number;        // Dynamically computed
  academicYear: string;           // Current academic year
}

/**
 * Teacher with full details for display
 */
export interface TeacherProfile extends Teacher {
  // Additional computed fields can be added
}

/**
 * No-due request with full teacher and student details
 */
export interface NoDueRequestWithDetails extends NoDueRequest {
  teacherName: string;            // Teacher name (joined)
  teacherEmail: string;           // Teacher email (joined)
  subjectName?: string;           // Subject name if applicable (joined)
}

// ============================================================================
// DOCUMENT ID GENERATORS (Utility functions)
// ============================================================================

/**
 * Generates curriculum document ID
 */
export function generateCurriculumId(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string
): string {
  return `${departmentId}_${batchYear}_${semesterNumber}_${subjectCode}`;
}

/**
 * Generates core subject teacher mapping document ID
 */
export function generateCoreSubjectMappingId(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string,
  subjectCode: string
): string {
  return `${departmentId}_${batchYear}_${semesterNumber}_${section}_${subjectCode}`;
}

/**
 * Generates open elective offering document ID
 */
export function generateOpenElectiveOfferingId(
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string
): string {
  return `${departmentId}_${batchYear}_${semesterNumber}_${subjectCode}`;
}

/**
 * Generates student elective choice document ID
 */
export function generateStudentElectiveChoiceId(
  usn: string,
  semesterNumber: number
): string {
  return `${usn}_${semesterNumber}`;
}

/**
 * Generates no-due request document ID
 */
export function generateNoDueRequestId(
  usn: string,
  referenceId: string
): string {
  return `ND_${usn}_${referenceId}`;
}

/**
 * Calculates current semester based on batch year and academic context
 */
export function calculateSemester(
  batchYear: number,
  academicYear: string,
  semesterType: SemesterType
): number {
  // Extract the starting year from academic year (e.g., "2025-26" -> 2025)
  const currentYear = parseInt(academicYear.split('-')[0]);
  
  // Calculate years elapsed since admission
  const yearsElapsed = currentYear - batchYear;
  
  // Calculate semester: 2 semesters per year + 1 for odd, 2 for even
  const semester = (yearsElapsed * 2) + (semesterType === 'odd' ? 1 : 2);
  
  // Clamp between 1 and 8 (typical 4-year program)
  return Math.max(1, Math.min(8, semester));
}

// ============================================================================
// COLLECTION: course_feedback_tracking
// Document ID: {usn}_{departmentId}_{semesterNumber}_{academicYear}
// ============================================================================

export interface CourseFeedbackTracking {
  usn: string;                      // Student USN
  departmentId: string;             // Department ID
  semesterNumber: number;           // Semester number
  academicYear: string;             // Academic year (e.g., "2025-26")
  allFeedbackCompleted: boolean;    // True only if feedback completed for ALL subjects
  completedSubjects: string[];      // List of subject codes with feedback completed
  totalSubjects: number;            // Total core + open elective subjects for this semester
  uploadedAt: Timestamp;            // When the feedback data was uploaded
  uploadedBy: string;               // Admin ID who uploaded the data
  
  // Additional tracking info
  lastUpdated: Timestamp;
}

// ============================================================================
// FEEDBACK STATUS FOR NO-DUE PROCESSING
// Used to track which subjects need feedback from a student
// ============================================================================

export interface SubjectFeedbackStatus {
  subjectCode: string;
  subjectName: string;
  type: 'core' | 'open_elective';
  feedbackCompleted: boolean;
  feedbackNotifications?: {
    studentNotified: boolean;
    teacherNotified: boolean;
    notifiedAt?: Timestamp;
  };
}

// ============================================================================
// COLLECTION: backlogs
// Document ID: auto-generated
// ============================================================================
// Stores backlog subjects for students that should appear in hall tickets
// without examination dates until they are cleared

export interface Backlog {
  id: string;                      // Document ID (auto-generated)
  usn: string;                      // Student USN with the backlog
  subjectCode: string;              // Code of the backlog subject
  subjectName: string;              // Name of the backlog subject
  departmentId: string;             // Department of the student
  semesterNumber: number;           // Semester in which backlog exists
  status: 'pending' | 'cleared';    // Status of the backlog (pending = still needed to clear, cleared = student has cleared it)
  createdAt: Timestamp;             // When the backlog was added
  createdBy: string;                // Admin ID who created the backlog
  clearedAt?: Timestamp;            // When the backlog was marked as cleared
  clearedBy?: string;               // Admin ID who marked it as cleared
  notes?: string;                   // Optional notes about the backlog
}

