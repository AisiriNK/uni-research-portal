# No-Due Automation System - Schema Update Documentation

## 🎯 Overview

This document describes the complete Firebase schema update and implementation changes for the no-due automation system. All changes follow the exact specification provided, with NO manual teacher selection and full automatic routing.

---

## 📊 Database Schema (FINAL)

### Collection: `students`
**Document ID**: `usn` (Unique Student Number)

```typescript
{
  usn: string,                    // Document ID
  name: string,
  departmentId: string,           // e.g., "CS", "EC", "ME"
  batchYear: number,              // e.g., 2021, 2022, 2023
  section: string,                // e.g., "A", "B", "C"
  email: string,
  mentorEmployeeId: string,       // Assigned mentor (ONE mentor per student)
  createdAt: Timestamp
}
```

### Collection: `teachers`
**Document ID**: `employeeId`

```typescript
{
  employeeId: string,             // Document ID
  name: string,
  departmentId: string,           // Department OR "institution" for institution-wide roles
  email: string,
  role: 'faculty' | 'mentor' | 'librarian' | 'accounts' | 'sports' | 'admin',
  createdAt: Timestamp
}
```

### Collection: `academic_context`
**Document ID**: `"current"` (singleton)

```typescript
{
  academicYear: string,           // e.g., "2025-26"
  semesterType: 'odd' | 'even'
}
```

### Collection: `curriculum`
**Document ID**: `{departmentId}_{batchYear}_{semesterNumber}_{subjectCode}`

```typescript
{
  departmentId: string,
  batchYear: number,
  semesterNumber: number,         // 1-8
  subjectCode: string,            // e.g., "CS501"
  subjectName: string,
  subjectType: 'core' | 'open_elective'
}
```

### Collection: `core_subject_teacher_mapping`
**Document ID**: `{departmentId}_{batchYear}_{semester}_{section}_{subjectCode}`

```typescript
{
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string,
  subjectCode: string,
  teacherEmployeeId: string       // Assigned teacher
}
```

### Collection: `open_elective_offerings`
**Document ID**: `{departmentId}_{batchYear}_{semester}_{subjectCode}`

```typescript
{
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string,
  subjectName: string,
  teacherEmployeeId: string       // Teacher offering this elective
}
```

### Collection: `student_elective_choice`
**Document ID**: `{usn}_{semesterNumber}`

```typescript
{
  usn: string,
  batchYear: number,
  semesterNumber: number,
  subjectCode: string             // Chosen elective
}
```

### Collection: `common_clearance_types`
**Fixed Document IDs**: `library`, `fees`, `sports`, `certificate`, `mentor`

```typescript
{
  clearanceTypeId: string,        // Document ID
  clearanceName: string,
  description: string
}
```

### Collection: `common_clearance_mapping`
**Document ID**: `{clearanceTypeId}`

```typescript
{
  clearanceTypeId: string,        // "library", "fees", "sports", "certificate"
  teacherEmployeeId: string       // Responsible staff
}
```

**NOTE**: Mentor clearance is NOT mapped here (uses `student.mentorEmployeeId`)

### Collection: `no_due_requests`
**Document ID**: `ND_{usn}_{referenceId}`

```typescript
{
  usn: string,
  studentName: string,            // Denormalized for display
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string,
  referenceType: 'core_subject' | 'open_elective' | 'common_clearance' | 'mentor',
  referenceId: string,            // Subject code or clearance type
  teacherEmployeeId: string,      // Auto-assigned teacher
  status: 'pending' | 'approved' | 'rejected',
  requestedAt: Timestamp,
  approvedAt?: Timestamp,
  rejectionReason?: string
}
```

### Collection: `admins`
**Document ID**: `{adminId}`

```typescript
{
  adminId: string,                // Document ID
  departmentId: string,           // Department they manage
  role: 'department_admin',
  email: string,
  createdAt: Timestamp
}
```

### Collection: `users` (Helper collection)
**Document ID**: Firebase Auth UID

```typescript
{
  email: string,
  role: 'student' | 'teacher' | 'department_admin',
  profileId: string,              // Links to usn/employeeId/adminId
  createdAt: Timestamp
}
```

---

## 🔄 Key Logic Changes

### 1. Semester Calculation (Automatic)

```typescript
/**
 * Formula: (currentYear - batchYear) * 2 + (semesterType === 'odd' ? 1 : 2)
 * 
 * Example:
 * - Batch: 2023
 * - Academic Year: 2025-26
 * - Semester Type: odd
 * 
 * Calculation:
 * - Years elapsed: 2025 - 2023 = 2
 * - Semester: 2 * 2 + 1 = 5 (5th semester)
 */
```

Implemented in: `src/types/schema.ts` → `calculateSemester()`

### 2. No-Due Request Auto-Routing

**Students NEVER select teachers manually.** All routing is automatic based on:

1. **Core Subjects**: Routes to section-specific teacher from `core_subject_teacher_mapping`
2. **Open Elective**: Routes to teacher from `open_elective_offerings` based on student's choice
3. **Library**: Routes to institution-wide librarian (`departmentId === "institution"`)
4. **Fees**: Routes to accounts staff from `common_clearance_mapping`
5. **Sports**: Routes to sports coordinator from `common_clearance_mapping`
6. **Certificate**: Routes to admin staff from `common_clearance_mapping`
7. **Mentor**: Routes DIRECTLY to `student.mentorEmployeeId`

Implemented in: `src/services/noDueAutomationService.ts` → `generateNoDueRequests()`

### 3. Teacher Access Control

Teachers ONLY see no-due requests where:
```typescript
request.teacherEmployeeId === loggedInTeacherEmployeeId
```

Implemented in: `src/services/noDueAutomationService.ts` → `getTeacherNoDueRequests()`

---

## 📁 Files Created/Updated

### New Files Created

1. **`src/types/schema.ts`**
   - Complete TypeScript definitions for all collections
   - Document ID generators
   - Semester calculation utilities

2. **`src/services/noDueAutomationService.ts`**
   - Core no-due automation logic
   - Auto-routing implementation
   - Request generation and queries

3. **`seed-nodue-database.js`**
   - Populates initial database with sample data
   - Run once after Firebase setup

4. **`NO_DUE_SCHEMA_MIGRATION.md`**
   - This documentation file

### Updated Files

1. **`src/types/user.ts`**
   - Updated User types to match new schema
   - Added `Student`, `Teacher`, `DepartmentAdmin` interfaces
   - Legacy aliases for backward compatibility

2. **`src/contexts/AuthContext.tsx`**
   - Updated signup logic for new document ID structure
   - Students: Document ID = `usn` (not `uid`)
   - Teachers: Document ID = `employeeId` (not `uid`)
   - Admins: Document ID = `adminId` (not `uid`)
   - Added `profileId` lookup in `users` collection

3. **`firestore.rules`**
   - Complete security rules rewrite
   - Supports new document ID structure
   - Access control based on `profileId` instead of `uid`
   - Teacher-specific read access for assigned requests

### Files to Update (Manual)

The following files may need updates to use the new schema:

- `src/pages/StudentDashboard.tsx` - Use new no-due service
- `src/pages/TeacherDashboard.tsx` - Display teacher-assigned requests
- `src/pages/Signup.tsx` - Update form fields (usn, employeeId, etc.)
- `src/services/noDueService.ts` - Deprecated (use noDueAutomationService.ts)

---

## 🚀 Setup Instructions

### Step 1: Deploy Firestore Rules

```powershell
firebase deploy --only firestore:rules
```

### Step 2: Seed Database

```powershell
node seed-nodue-database.js
```

This creates:
- Academic context (2025-26, odd semester)
- Common clearance types (library, fees, sports, certificate, mentor)
- Sample teachers (7)
- Common clearance mappings (4)
- Sample curriculum (CS, Batch 2023, Semester 5)
- Core subject mappings (3)
- Open elective offerings (1)
- Sample students (2)
- Student elective choices (2)

### Step 3: Update Frontend Components

Update components to use the new service:

```typescript
import { 
  generateNoDueRequests,
  getStudentNoDueRequests,
  getTeacherNoDueRequests,
  approveNoDueRequest,
  rejectNoDueRequest
} from '@/services/noDueAutomationService';
```

---

## 🔐 Security Highlights

1. **Students Collection**: Document ID is `usn` (not `uid`)
   - Access via `profileId` from `users` collection
   - Students can only read/write their own profile

2. **Teachers Collection**: Document ID is `employeeId` (not `uid`)
   - Anyone authenticated can read (needed for lookups)
   - Teachers can only update their own profile

3. **No-Due Requests**: Document ID is `ND_{usn}_{referenceId}`
   - Students can only read requests starting with `ND_{their_usn}_`
   - Teachers can only read requests where `teacherEmployeeId` matches their ID
   - Teachers can only update status (cannot reassign)

4. **Admin Collections**: Admins can write curriculum, mappings, clearances
   - Students/teachers can only read

---

## 📊 Data Flow Example

### Example: Student Generates No-Due Requests

**Student**: Alice Johnson (USN: `1CS21CS001`)
- Department: CS
- Batch Year: 2023
- Section: A
- Mentor: CS003

**Current Context**: 2025-26 (odd semester)

**Computed Semester**: 5

**Auto-Generated Requests**:

1. **CS501 (Software Engineering)**
   - Type: `core_subject`
   - Teacher: `CS001` (from core_subject_teacher_mapping)
   - Request ID: `ND_1CS21CS001_CS501`

2. **CS502 (DBMS)**
   - Type: `core_subject`
   - Teacher: `CS002`
   - Request ID: `ND_1CS21CS001_CS502`

3. **CS503 (OS)**
   - Type: `core_subject`
   - Teacher: `CS001`
   - Request ID: `ND_1CS21CS001_CS503`

4. **CS9OE1 (Machine Learning)**
   - Type: `open_elective`
   - Teacher: `CS002` (from student's elective choice)
   - Request ID: `ND_1CS21CS001_CS9OE1`

5. **Library**
   - Type: `common_clearance`
   - Teacher: `LIB001` (institution-wide librarian)
   - Request ID: `ND_1CS21CS001_library`

6. **Fees**
   - Type: `common_clearance`
   - Teacher: `ACC001` (from common_clearance_mapping)
   - Request ID: `ND_1CS21CS001_fees`

7. **Sports**
   - Type: `common_clearance`
   - Teacher: `SPO001`
   - Request ID: `ND_1CS21CS001_sports`

8. **Certificate**
   - Type: `common_clearance`
   - Teacher: `ADM001`
   - Request ID: `ND_1CS21CS001_certificate`

9. **Mentor**
   - Type: `mentor`
   - Teacher: `CS003` (from student.mentorEmployeeId)
   - Request ID: `ND_1CS21CS001_mentor`

**Total Requests**: 9 (all auto-routed, NO manual selection!)

---

## ⚠️ Breaking Changes

### Document ID Structure Changed

**Old System**:
- Students: Document ID = Firebase Auth UID
- Teachers: Document ID = Firebase Auth UID

**New System**:
- Students: Document ID = USN
- Teachers: Document ID = Employee ID
- Admins: Document ID = Admin ID

**Migration Required**: Existing documents need to be re-created with new IDs.

### Field Name Changes

**Students**:
- `regNo` → `usn`
- `dept` → `departmentId`
- Added: `batchYear`, `section`, `mentorEmployeeId`

**Teachers**:
- `empId` → `employeeId`
- `dept` → `departmentId`
- Added: `role` (faculty/mentor/librarian/etc.)

### Removed Collections

- `reprography_admins` → Now use `admins` with role `department_admin`

### New Required Collections

- `academic_context` (must be configured)
- `curriculum` (must be populated per department/batch)
- `core_subject_teacher_mapping` (must be populated)
- `open_elective_offerings` (must be populated)
- `student_elective_choice` (students must choose electives)
- `common_clearance_types` (use seed script)
- `common_clearance_mapping` (use seed script)

---

## ✅ Validation Checklist

Before going live, ensure:

- [ ] Firestore rules deployed
- [ ] Seed script run successfully
- [ ] Academic context configured
- [ ] All departments have curriculum defined
- [ ] Core subject mappings created for all sections
- [ ] Open electives offered and mapped to teachers
- [ ] Common clearance mappings configured
- [ ] Institution-wide librarian assigned
- [ ] All teachers have correct roles
- [ ] All students have mentors assigned
- [ ] Frontend components updated to use new service
- [ ] Signup forms updated with new fields
- [ ] Dashboards display auto-routed requests correctly

---

## 🔧 Maintenance

### Updating Academic Context (Each Semester)

```typescript
import { updateAcademicContext } from '@/services/noDueAutomationService';

// Switch to even semester
await updateAcademicContext('2025-26', 'even');

// Next academic year (odd semester)
await updateAcademicContext('2026-27', 'odd');
```

### Adding New Curriculum

```typescript
// Use batch writes for efficiency
const batch = writeBatch(db);

const docId = `CS_2024_6_CS601`;  // CS dept, batch 2024, sem 6, subject CS601
const docRef = doc(db, 'curriculum', docId);

batch.set(docRef, {
  departmentId: 'CS',
  batchYear: 2024,
  semesterNumber: 6,
  subjectCode: 'CS601',
  subjectName: 'Compiler Design',
  subjectType: 'core'
});

await batch.commit();
```

### Assigning Teachers to Core Subjects

```typescript
const docId = `CS_2024_6_A_CS601`;  // CS, batch 2024, sem 6, section A, subject CS601
const docRef = doc(db, 'core_subject_teacher_mapping', docId);

await setDoc(docRef, {
  departmentId: 'CS',
  batchYear: 2024,
  semesterNumber: 6,
  section: 'A',
  subjectCode: 'CS601',
  teacherEmployeeId: 'CS005'  // Assigned teacher
});
```

---

## 📞 Support

For issues or questions:
1. Check this documentation first
2. Review `src/types/schema.ts` for type definitions
3. Review `src/services/noDueAutomationService.ts` for logic
4. Check Firestore rules for access control
5. Run seed script to reset test data

---

## 📝 Summary

This update implements a **fully automated no-due system** with:

✅ **Zero manual teacher selection** (all routing is automatic)  
✅ **Dynamic semester calculation** (based on batch year and academic context)  
✅ **Section-wise teacher mapping** (core subjects)  
✅ **Institution-wide clearances** (library, fees, sports, etc.)  
✅ **Mentor auto-assignment** (from student profile)  
✅ **Role-based access control** (students, teachers, admins)  
✅ **Scalable architecture** (supports multiple departments and batches)  

**NO MANUAL TEACHER SELECTION. ALL ROUTING IS AUTOMATED.** 🎯
