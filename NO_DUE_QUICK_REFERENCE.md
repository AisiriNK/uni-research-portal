# No-Due Automation - Developer Quick Reference

## 🚀 Quick Start

### Import Services

```typescript
// Main no-due automation service
import {
  generateNoDueRequests,
  getStudentNoDueRequests,
  getTeacherNoDueRequests,
  approveNoDueRequest,
  rejectNoDueRequest,
  checkNoDueClearanceStatus,
} from '@/services/noDueAutomationService';

// Admin management service
import {
  updateAcademicContext,
  addCurriculum,
  assignCoreSubjectTeacher,
  addOpenElectiveOffering,
  updateCommonClearanceMapping,
} from '@/services/adminService';

// Type definitions
import {
  Student,
  Teacher,
  NoDueRequest,
  Curriculum,
  CoreSubjectTeacherMapping,
} from '@/types/schema';
```

---

## 📊 Common Operations

### Student: Generate No-Due Requests

```typescript
// Automatically generates ALL no-due requests for student
const result = await generateNoDueRequests(studentUsn);

console.log(`Created ${result.requestsCreated} requests`);
console.log('Errors:', result.errors);
```

### Student: View No-Due Status

```typescript
// Get all no-due requests with details
const requests = await getStudentNoDueRequests(studentUsn);

// Check overall clearance status
const status = await checkNoDueClearanceStatus(studentUsn);

console.log(`Approved: ${status.approvedCount}/${status.totalRequests}`);
console.log(`All cleared: ${status.allApproved}`);
```

### Teacher: View Assigned Requests

```typescript
// Get only requests assigned to this teacher
const requests = await getTeacherNoDueRequests(teacherEmployeeId);

// Filter by status
const pending = requests.filter(r => r.status === 'pending');
const approved = requests.filter(r => r.status === 'approved');
```

### Teacher: Approve/Reject Request

```typescript
// Approve
await approveNoDueRequest(requestId);

// Reject with reason
await rejectNoDueRequest(requestId, 'Pending library dues of Rs. 500');
```

---

## 🔧 Admin Operations

### Update Academic Context (Start of Semester)

```typescript
// Switch to even semester
await updateAcademicContext('2025-26', 'even');

// Next academic year
await updateAcademicContext('2026-27', 'odd');
```

### Add Curriculum

```typescript
// Single subject
await addCurriculum({
  departmentId: 'CS',
  batchYear: 2023,
  semesterNumber: 6,
  subjectCode: 'CS601',
  subjectName: 'Compiler Design',
  subjectType: 'core'
});

// Batch add (entire semester)
await setupSemesterCurriculum('CS', 2023, 6, [
  { subjectCode: 'CS601', subjectName: 'Compiler Design', subjectType: 'core' },
  { subjectCode: 'CS602', subjectName: 'Computer Networks', subjectType: 'core' },
  { subjectCode: 'CS603', subjectName: 'Web Technologies', subjectType: 'core' },
  { subjectCode: 'CS9OE2', subjectName: 'Cloud Computing', subjectType: 'open_elective' },
]);
```

### Assign Teachers to Core Subjects

```typescript
// Single assignment
await assignCoreSubjectTeacher({
  departmentId: 'CS',
  batchYear: 2023,
  semesterNumber: 6,
  section: 'A',
  subjectCode: 'CS601',
  teacherEmployeeId: 'CS001'
});

// Batch assign (entire section)
await setupSectionTeachers('CS', 2023, 6, 'A', [
  { subjectCode: 'CS601', teacherEmployeeId: 'CS001' },
  { subjectCode: 'CS602', teacherEmployeeId: 'CS002' },
  { subjectCode: 'CS603', teacherEmployeeId: 'CS003' },
]);
```

### Add Open Elective Offering

```typescript
await addOpenElectiveOffering({
  departmentId: 'CS',
  batchYear: 2023,
  semesterNumber: 6,
  subjectCode: 'CS9OE2',
  subjectName: 'Cloud Computing',
  teacherEmployeeId: 'CS004'
});
```

### Update Common Clearance Mappings

```typescript
// Assign new librarian
await updateCommonClearanceMapping('library', 'LIB002');

// Assign new accounts staff
await updateCommonClearanceMapping('fees', 'ACC002');
```

---

## 🔐 Authentication & Signup

### Student Signup

```typescript
await signup({
  email: 'student@university.edu',
  password: 'securepass123',
  name: 'John Doe',
  role: 'student',
  usn: '1CS21CS123',
  departmentId: 'CS',
  batchYear: 2023,
  section: 'A',
  mentorEmployeeId: 'CS005'
});
```

### Teacher Signup

```typescript
await signup({
  email: 'teacher@university.edu',
  password: 'securepass123',
  name: 'Dr. Jane Smith',
  role: 'teacher',
  employeeId: 'CS010',
  departmentId: 'CS',
  teacherRole: 'faculty'  // or 'mentor', 'librarian', etc.
});
```

### Admin Signup

```typescript
await signup({
  email: 'admin@university.edu',
  password: 'securepass123',
  name: 'Admin Officer',
  role: 'department_admin',
  adminId: 'ADM001',
  departmentId: 'CS'
});
```

---

## 📐 Utility Functions

### Calculate Current Semester

```typescript
import { calculateSemester } from '@/types/schema';

const semester = calculateSemester(
  2023,              // batchYear
  '2025-26',         // academicYear
  'odd'              // semesterType
);

console.log(`Current semester: ${semester}`);  // Output: 5
```

### Generate Document IDs

```typescript
import {
  generateCurriculumId,
  generateCoreSubjectMappingId,
  generateOpenElectiveOfferingId,
  generateNoDueRequestId,
} from '@/types/schema';

// Curriculum ID
const currId = generateCurriculumId('CS', 2023, 5, 'CS501');
// Output: "CS_2023_5_CS501"

// Core subject mapping ID
const mappingId = generateCoreSubjectMappingId('CS', 2023, 5, 'A', 'CS501');
// Output: "CS_2023_5_A_CS501"

// No-due request ID
const requestId = generateNoDueRequestId('1CS21CS001', 'CS501');
// Output: "ND_1CS21CS001_CS501"
```

---

## 🎨 Component Examples

### Student Dashboard - Display No-Due Status

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getStudentNoDueRequests } from '@/services/noDueAutomationService';

function StudentNoDueDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  
  useEffect(() => {
    if (user && user.role === 'student') {
      getStudentNoDueRequests(user.usn).then(setRequests);
    }
  }, [user]);
  
  return (
    <div>
      <h2>My No-Due Requests</h2>
      {requests.map(req => (
        <div key={req.referenceId}>
          <p>{req.referenceType}: {req.referenceId}</p>
          <p>Teacher: {req.teacherName}</p>
          <p>Status: {req.status}</p>
        </div>
      ))}
    </div>
  );
}
```

### Teacher Dashboard - Approve Requests

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getTeacherNoDueRequests, 
  approveNoDueRequest,
  rejectNoDueRequest 
} from '@/services/noDueAutomationService';

function TeacherNoDueDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  
  useEffect(() => {
    if (user && user.role === 'teacher') {
      getTeacherNoDueRequests(user.employeeId).then(setRequests);
    }
  }, [user]);
  
  const handleApprove = async (requestId) => {
    await approveNoDueRequest(requestId);
    // Refresh requests
    const updated = await getTeacherNoDueRequests(user.employeeId);
    setRequests(updated);
  };
  
  const handleReject = async (requestId, reason) => {
    await rejectNoDueRequest(requestId, reason);
    // Refresh requests
    const updated = await getTeacherNoDueRequests(user.employeeId);
    setRequests(updated);
  };
  
  return (
    <div>
      <h2>Assigned No-Due Requests</h2>
      {requests.filter(r => r.status === 'pending').map(req => (
        <div key={req.referenceId}>
          <p>Student: {req.studentName} ({req.usn})</p>
          <p>Request: {req.referenceType} - {req.referenceId}</p>
          <button onClick={() => handleApprove(`ND_${req.usn}_${req.referenceId}`)}>
            Approve
          </button>
          <button onClick={() => handleReject(`ND_${req.usn}_${req.referenceId}`, 'Pending dues')}>
            Reject
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔍 Debugging

### Check Academic Context

```typescript
import { getAcademicContext } from '@/services/noDueAutomationService';

const context = await getAcademicContext();
console.log('Academic Year:', context.academicYear);
console.log('Semester Type:', context.semesterType);
```

### Verify Student Data

```typescript
import { getStudentWithSemester } from '@/services/noDueAutomationService';

const student = await getStudentWithSemester('1CS21CS001');
console.log('Current Semester:', student.currentSemester);
console.log('Mentor:', student.mentorEmployeeId);
```

### Check Teacher Exists

```typescript
import { getTeacher } from '@/services/noDueAutomationService';

try {
  const teacher = await getTeacher('CS001');
  console.log('Teacher:', teacher.name, teacher.role);
} catch (error) {
  console.error('Teacher not found');
}
```

### Validate Configuration

```typescript
import { validateTeacher, validateCurriculumSubject } from '@/services/adminService';

// Check if teacher exists
const teacherExists = await validateTeacher('CS001');

// Check if subject exists in curriculum
const subjectExists = await validateCurriculumSubject('CS', 2023, 5, 'CS501');
```

---

## 🚨 Common Errors

### "Academic context not configured"
**Solution**: Run seed script or manually set:
```typescript
await updateAcademicContext('2025-26', 'odd');
```

### "No teacher assigned for {subjectCode}"
**Solution**: Assign teacher to core subject:
```typescript
await assignCoreSubjectTeacher({
  departmentId: 'CS',
  batchYear: 2023,
  semesterNumber: 5,
  section: 'A',
  subjectCode: 'CS501',
  teacherEmployeeId: 'CS001'
});
```

### "No open elective choice recorded"
**Solution**: Student must select an elective:
```typescript
// In student_elective_choice collection
await setDoc(doc(db, 'student_elective_choice', '1CS21CS001_5'), {
  usn: '1CS21CS001',
  batchYear: 2023,
  semesterNumber: 5,
  subjectCode: 'CS9OE1'
});
```

### "No librarian configured"
**Solution**: Create institution-wide librarian:
```typescript
await setDoc(doc(db, 'teachers', 'LIB001'), {
  employeeId: 'LIB001',
  name: 'Dr. Librarian',
  email: 'librarian@university.edu',
  departmentId: 'institution',
  role: 'librarian',
  createdAt: new Date()
});

await updateCommonClearanceMapping('library', 'LIB001');
```

---

## 📚 Type Reference

### Student Profile

```typescript
{
  usn: string,              // Document ID
  name: string,
  departmentId: string,     // e.g., "CS"
  batchYear: number,        // e.g., 2023
  section: string,          // e.g., "A"
  email: string,
  mentorEmployeeId: string, // Assigned mentor
  currentSemester: number   // Computed dynamically
}
```

### No-Due Request

```typescript
{
  usn: string,
  studentName: string,
  departmentId: string,
  batchYear: number,
  semesterNumber: number,
  section: string,
  referenceType: 'core_subject' | 'open_elective' | 'common_clearance' | 'mentor',
  referenceId: string,      // Subject code or clearance type
  teacherEmployeeId: string,
  status: 'pending' | 'approved' | 'rejected',
  requestedAt: Timestamp,
  approvedAt?: Timestamp,
  rejectionReason?: string
}
```

---

## ✅ Testing Checklist

Before deployment, test:

- [ ] Student can generate no-due requests
- [ ] All 9 request types are created (core subjects + elective + 5 clearances)
- [ ] Teacher only sees their assigned requests
- [ ] Teacher can approve/reject requests
- [ ] Semester calculation is correct
- [ ] Mentor clearance routes to correct mentor
- [ ] Library clearance routes to institution librarian
- [ ] Admin can update academic context
- [ ] Admin can add curriculum
- [ ] Admin can assign teachers

---

## 📞 Need Help?

1. Check [NO_DUE_SCHEMA_MIGRATION.md](./NO_DUE_SCHEMA_MIGRATION.md) for detailed schema
2. Review [src/types/schema.ts](./src/types/schema.ts) for type definitions
3. Check [src/services/noDueAutomationService.ts](./src/services/noDueAutomationService.ts) for implementation
4. Run seed script to reset test data: `node seed-nodue-database.js`
