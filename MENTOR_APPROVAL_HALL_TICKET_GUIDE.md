# Complete No-Due Clearance Workflow with Mentor Approval & Hall Ticket Generation

## Overview

This document describes the complete end-to-end workflow for the no-due clearance system with mentor approval and hall ticket generation.

**Institution:** BNM Institute of Technology

**Important:** Mentors are faculty members (teachers) who have additional mentor responsibilities. They use the **same Teacher Dashboard** for both subject teaching and mentor approval functions. There is no separate mentor dashboard.

## Workflow Stages

```
Student Request
     ↓
Faculty Approvals (Core subjects, Electives, Common clearances)
     ↓
All Faculty Approved → Automatic progression to Mentor Approval
     ↓
Mentor (Faculty) Reviews All Clearances
     ↓
Mentor (Faculty) Approval
     ↓
Admin Generates Hall Ticket
     ↓
Student Receives Hall Ticket PDF
```

## Complete Workflow

### Stage 1: Student Generates No-Due Requests

**Actor:** Student  
**Action:** Click "Generate No-Due Requests" button

```typescript
import { generateNoDueRequests } from '@/services/noDueAutomationService';

// In StudentDashboard.tsx
async function handleGenerateRequests() {
  const result = await generateNoDueRequests(studentUSN);
  
  console.log(`Created ${result.requestsCreated} requests`);
  if (result.errors.length > 0) {
    console.warn('Errors:', result.errors);
  }
}
```

**What happens:**
- System calculates current semester automatically
- Creates no-due requests for:
  1. All core subjects (4-6 subjects)
  2. Open elective (1 subject)
  3. Common clearances (library, fees, sports, certificate)
  4. Mentor clearance
- All requests are automatically routed to correct teachers
- Initial status: `pending`

**Example requests created for student "1CS21CS001":**
| Reference Type | Reference ID | Teacher | Status |
|----------------|--------------|---------|--------|
| core_subject | 21CS51 | CS001 | pending |
| core_subject | 21CS52 | CS002 | pending |
| core_subject | 21CS53 | CS003 | pending |
| core_subject | 21CS54 | CS004 | pending |
| open_elective | 21CSE561 | CS010 | pending |
| common_clearance | library | LIB001 | pending |
| common_clearance | fees | ACCT001 | pending |
| common_clearance | sports | SPT001 | pending |
| common_clearance | certificate | CERT001 | pending |
| mentor | mentor | CS001 | pending |

### Stage 2: Teachers Review and Approve

**Actor:** Teachers (Subject teachers, Librarian, Accounts staff, Sports in-charge, etc.)  
**Action:** Approve/Reject clearance requests

```typescript
import { approveNoDueRequest, rejectNoDueRequest } from '@/services/noDueAutomationService';

// In TeacherDashboard.tsx
async function handleApprove(requestId: string) {
  await approveNoDueRequest(requestId);
  // System automatically checks if all teachers have approved
}

async function handleReject(requestId: string, reason: string) {
  await rejectNoDueRequest(requestId, reason);
}
```

**What happens:**
- Each teacher sees only their assigned clearances
- Teacher clicks "Approve" or "Reject" with reason
- Request status updates: `pending` → `approved` or `rejected`
- **Automatic progression:** When the last teacher approves:
  - System detects all non-mentor requests are approved
  - Mentor request automatically changes: `pending` → `pending_mentor_approval`

**Example after all teachers approve:**
| Reference Type | Reference ID | Teacher | Status |
|----------------|--------------|---------|--------|
| core_subject | 21CS51 | CS001 | ✅ approved |
| core_subject | 21CS52 | CS002 | ✅ approved |
| core_subject | 21CS53 | CS003 | ✅ approved |
| core_subject | 21CS54 | CS004 | ✅ approved |
| open_elective | 21CSE561 | CS010 | ✅ approved |
| common_clearance | library | LIB001 | ✅ approved |
| common_clearance | fees | ACCT001 | ✅ approved |
| common_clearance | sports | SPT001 | ✅ approved |
| common_clearance | certificate | CERT001 | ✅ approved |
| mentor | mentor | CS001 | ⏳ **pending_mentor_approval** |

### Stage 3: Mentor Reviews All Clearances

**Actor:** Mentor (Class teacher)  
**Action:** View all clearances received by mentee

```typescript
import { getMenteeClearances, getStudentsReadyForMentorApproval } from '@/services/mentorApprovalService';

// In MentorDashboard.tsx
async function loadMentees() {
  // Get all students ready for mentor approval
  const readyStudents = await getStudentsReadyForMentorApproval(mentorEmployeeId);
  
  // Get detailed clearances for a specific student
  const allMentees = await getMenteeClearances(mentorEmployeeId);
  
  // Example output:
  // {
  //   usn: "1CS21CS001",
  //   studentName: "Amit Kumar",
  //   totalClearances: 10,
  //   approvedClearances: 9,
  //   pendingClearances: 1, // The mentor clearance itself
  //   readyForMentorApproval: true,
  //   clearanceDetails: [
  //     { referenceType: 'core_subject', referenceId: '21CS51', status: 'approved', ... },
  //     { referenceType: 'library', referenceId: 'library', status: 'approved', ... },
  //     ...
  //   ]
  // }
}
```

**UI Display (Teacher Dashboard - Mentor Section):**

When a faculty member logs in who is assigned as a mentor to students, they see an additional "My Mentees" section in their Teacher Dashboard:

```
Student: Amit Kumar (1CS21CS001)
Semester: 5, Section: A

✅ All clearances received! Ready for final approval.

Clearance Summary:
✅ Core Subject: 21CS51 (Approved by CS001 on Jan 15, 2026)
✅ Core Subject: 21CS52 (Approved by CS002 on Jan 16, 2026)
✅ Core Subject: 21CS53 (Approved by CS003 on Jan 17, 2026)
✅ Core Subject: 21CS54 (Approved by CS004 on Jan 18, 2026)
✅ Open Elective: 21CSE561 (Approved by CS010 on Jan 19, 2026)
✅ Library Clearance (Approved by LIB001 on Jan 20, 2026)
✅ Fees Clearance (Approved by ACCT001 on Jan 21, 2026)
✅ Sports Clearance (Approved by SPT001 on Jan 22, 2026)
✅ Certificate Clearance (Approved by CERT001 on Jan 23, 2026)

[Approve] [Reject with Reason]
```

### Stage 4: Mentor Final Approval

**Actor:** Faculty member acting as Mentor  
**Location:** Teacher Dashboard - "My Mentees" section  
**Action:** Approve or reject with reason

```typescript
import { mentorApprove, mentorReject } from '@/services/mentorApprovalService';

// In TeacherDashboard.tsx (single dashboard for all faculty)
async function handleMentorApprove(usn: string) {
  await mentorApprove(usn, employeeId);
  
  // Updates:
  // - Mentor request: status → 'mentor_approved', mentorApprovalStatus → 'approved'
  // - All other requests: mentorApprovalStatus → 'approved', mentorApprovedAt → timestamp
}

async function handleMentorReject(usn: string, reason: string) {
  await mentorReject(usn, employeeId, reason);
  
  // Updates:
  // - Mentor request: status → 'mentor_rejected', mentorRejectionReason → reason
  // - All other requests: mentorApprovalStatus → 'rejected'
}
```

**What happens after mentor approval:**
- Mentor request status: `pending_mentor_approval` → `mentor_approved`
- `mentorApprovalStatus` field set to `'approved'` for ALL requests
- `mentorApprovedAt` timestamp recorded
- Student now appears in admin's "Ready for Hall Ticket" list

### Stage 5: Admin Generates Hall Ticket

**Actor:** Department Admin  
**Action:** Click "Generate Hall Ticket" button

```typescript
import { getStudentsReadyForHallTicket, downloadHallTicket, checkHallTicketEligibility } from '@/services/hallTicketService';

// In AdminDashboard.tsx
async function loadStudentsReadyForHallTicket() {
  const students = await getStudentsReadyForHallTicket(departmentId);
  
  // Example output:
  // [
  //   {
  //     usn: "1CS21CS001",
  //     studentName: "Amit Kumar",
  //     semesterNumber: 5,
  //     section: "A",
  //     mentorApprovedAt: Date(2026-01-25)
  //   }
  // ]
}

async function handleGenerateHallTicket(usn: string) {
  // Check eligibility first
  const eligibility = await checkHallTicketEligibility(usn);
  
  if (!eligibility.eligible) {
    alert(eligibility.reason);
    return;
  }
  
  // Generate and download PDF
  await downloadHallTicket(usn, adminId);
  
  // PDF is automatically downloaded
  // Database is updated with hallTicketGenerated: true
}
```

**UI Display (Admin Dashboard):**

```
Students Ready for Hall Ticket Generation

USN          Name           Semester  Section  Mentor Approved    Action
1CS21CS001   Amit Kumar     5         A        Jan 25, 2026       [Generate Hall Ticket]
1CS21CS002   Priya Sharma   5         A        Jan 26, 2026       [Generate Hall Ticket]
```

### Stage 6: Hall Ticket PDF Generated

**Output:** PDF file `HallTicket_1CS21CS001_Sem1738123456789.pdf`

**PDF Contents:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│            BNM INSTITUTE OF TECHNOLOGY                          │
│         Affiliated to VTU, Approved by AICTE                    │
│                                                                 │
│              EXAMINATION HALL TICKET                            │
│            Semester 5 - Academic Year 2025-26                   │
│─────────────────────────────────────────────────────────────────│
│                                                                 │
│  USN:         1CS21CS001                                        │
│  Name:        AMIT KUMAR                                        │
│  Department:  Computer Science and Engineering                  │
│  Semester:    5 (Section A)                                     │
│  Batch Year:  2021                                              │
│                                                                 │
│  Subjects Registered:                                           │
│  ┌─────┬──────────┬──────────────────────────────┬─────────┐  │
│  │ S.No│ Code     │ Subject Name                  │ Credits │  │
│  ├─────┼──────────┼──────────────────────────────┼─────────┤  │
│  │  1  │ 21CS51   │ Algorithms                    │    4    │  │
│  │  2  │ 21CS52   │ Database Management Systems   │    4    │  │
│  │  3  │ 21CS53   │ Operating Systems             │    4    │  │
│  │  4  │ 21CS54   │ Computer Networks             │    4    │  │
│  │  5  │ 21CSE561 │ Machine Learning              │    3    │  │
│  └─────┴──────────┴──────────────────────────────┴─────────┘  │
│                                                                 │
│                                                                 │
│  __________________                      ____________________  │
│  Student Signature                       Invigilator Signature │
│                                                                 │
│  This is a computer-generated hall ticket. No signature is     │
│  required.                                                      │
│  Generated on: 29/01/2026 at 10:30 AM                          │
└─────────────────────────────────────────────────────────────────┘
```

**What happens in database:**
- All requests updated:
  - `hallTicketGenerated`: `true`
  - `hallTicketGeneratedAt`: timestamp
  - `hallTicketGeneratedBy`: admin ID
  - `status`: `completed`

**Final request status after hall ticket:**
| Reference Type | Reference ID | Status | Mentor Approval | Hall Ticket |
|----------------|--------------|--------|-----------------|-------------|
| core_subject | 21CS51 | ✅ completed | ✅ approved | ✅ generated |
| core_subject | 21CS52 | ✅ completed | ✅ approved | ✅ generated |
| mentor | mentor | ✅ completed | ✅ approved | ✅ generated |

## Database Schema Updates

### NoDueRequest Interface (Updated)

```typescript
export interface NoDueRequest {
  // ... existing fields ...
  
  status: 'pending' | 'approved' | 'rejected' 
         | 'pending_mentor_approval' | 'mentor_approved' 
         | 'mentor_rejected' | 'completed';
  
  // Mentor approval stage
  mentorApprovalStatus?: 'pending' | 'approved' | 'rejected';
  mentorApprovedAt?: Timestamp;
  mentorRejectionReason?: string;
  
  // Hall ticket generation
  hallTicketGenerated?: boolean;
  hallTicketGeneratedAt?: Timestamp;
  hallTicketGeneratedBy?: string; // Admin ID
}
```

## Status Progression Chart

```
For Non-Mentor Requests (Subjects, Clearances):
pending → approved → (mentor approval) → completed
   ↓
rejected (if teacher rejects)

For Mentor Request:
pending → pending_mentor_approval → mentor_approved → completed
                                         ↓
                                    mentor_rejected
```

## Code Examples for Frontend Components

### Student Dashboard

```typescript
import { generateNoDueRequests, getStudentNoDueRequests } from '@/services/noDueAutomationService';

function StudentDashboard() {
  const { user } = useAuth(); // user.profileId is USN
  const [requests, setRequests] = useState<NoDueRequestWithDetails[]>([]);
  
  useEffect(() => {
    loadRequests();
  }, []);
  
  async function loadRequests() {
    const data = await getStudentNoDueRequests(user.profileId);
    setRequests(data);
  }
  
  async function handleGenerate() {
    const result = await generateNoDueRequests(user.profileId);
    if (result.success) {
      alert(`Generated ${result.requestsCreated} requests`);
      loadRequests();
    }
  }
  
  const allApproved = requests.every(r => r.status === 'approved' || r.mentorApprovalStatus === 'approved');
  const hallTicketGenerated = requests.some(r => r.hallTicketGenerated);
  
  return (
    <div>
      <h1>No-Due Clearance Status</h1>
      
      {requests.length === 0 && (
        <button onClick={handleGenerate}>Generate No-Due Requests</button>
      )}
      
      {allApproved && !hallTicketGenerated && (
        <div className="alert alert-success">
          ✅ All clearances approved! Waiting for mentor approval...
        </div>
      )}
      
      {hallTicketGenerated && (
        <div className="alert alert-success">
          🎉 Hall ticket generated! Check your downloads.
        </div>
      )}
      
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Subject/Clearance</th>
            <th>Teacher</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(req => (
            <tr key={req.referenceId}>
              <td>{req.referenceType}</td>
              <td>{req.subjectName || req.referenceId}</td>
              <td>{req.teacherName}</td>
              <td>
                {req.status === 'approved' && '✅ Approved'}
                {req.status === 'pending' && '⏳ Pending'}
                {req.status === 'pending_mentor_approval' && '⏳ Pending Mentor Approval'}
                {req.status === 'mentor_approved' && '✅ Mentor Approved'}
                {req.status === 'completed' && '✅ Completed'}
                {req.status === 'rejected' && `❌ Rejected: ${req.rejectionReason}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Teacher Dashboard (Unified Faculty Dashboard)

**Note:** This is a single dashboard that shows both subject teaching requests AND mentor responsibilities if the faculty member is assigned as a mentor.

```typescript
import { getTeacherNoDueRequests, approveNoDueRequest, rejectNoDueRequest } from '@/services/noDueAutomationService';
import { getMenteeClearances, mentorApprove, mentorReject } from '@/services/mentorApprovalService';

function TeacherDashboard() {
  const { user } = useAuth(); // user.profileId is employeeId
  const [subjectRequests, setSubjectRequests] = useState<NoDueRequestWithDetails[]>([]);
  const [mentees, setMentees] = useState<ClearanceSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<ClearanceSummary | null>(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  async function loadData() {
    // Load subject teaching requests
    const teachingData = await getTeacherNoDueRequests(user.profileId);
    setSubjectRequests(teachingData);
    
    // Load mentee data (if this faculty is a mentor)
    const menteeData = await getMenteeClearances(user.profileId);
    setMentees(menteeData);
  }
  
  // Subject approval functions
  async function handleApprove(requestId: string) {
    await approveNoDueRequest(requestId);
    alert('Approved successfully');
    loadData();
  }
  
  async function handleReject(requestId: string) {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      await rejectNoDueRequest(requestId, reason);
      loadData();
    }
  }
  
  // Mentor approval functions
  async function handleMentorApprove(usn: string) {
    const confirmed = confirm(`Approve all clearances for ${usn}?`);
    if (confirmed) {
      await mentorApprove(usn, user.profileId);
      alert('Approved successfully. Student is now ready for hall ticket.');
      loadData();
    }
  }
  
  async function handleMentorReject(usn: string) {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      await mentorReject(usn, user.profileId, reason);
      loadData();
    }
  }
  
  return (
    <div>
      {/* Section 1: Subject Teaching Clearances */}
      <section>
        <h1>No-Due Clearance Requests (Subject Teaching)</h1>
        <table>
          <thead>
            <tr>
              <th>USN</th>
              <th>Name</th>
              <th>Subject</th>
              <th>Semester</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {subjectRequests.map(req => (
              <tr key={`${req.usn}_${req.referenceId}`}>
                <td>{req.usn}</td>
                <td>{req.studentName}</td>
                <td>{req.subjectName || req.referenceId}</td>
                <td>{req.semesterNumber}</td>
                <td>{req.status}</td>
                <td>
                  {req.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(`ND_${req.usn}_${req.referenceId}`)}>
                        Approve
                      </button>
                      <button onClick={() => handleReject(`ND_${req.usn}_${req.referenceId}`)}>
                        Reject
                      </button>
                    </>
                  )}
                  {req.status === 'approved' && '✅ Approved'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      
      {/* Section 2: Mentor Responsibilities (shown only if faculty has mentees) */}
      {mentees.length > 0 && (
        <section className="mt-8">
          <h1>My Mentees - Final Approval</h1>
          <p className="text-muted-foreground mb-4">
            As a mentor, you can give final approval after all subject teachers have approved.
          </p>
          
          {mentees.map(mentee => (
            <div key={mentee.usn} className="card mb-4">
              <h3>{mentee.studentName} ({mentee.usn})</h3>
              <p>Semester: {mentee.semesterNumber}, Section: {mentee.section}</p>
              
              <div className="progress">
                <strong>Progress:</strong> {mentee.approvedClearances} / {mentee.totalClearances} approved
                {mentee.allApproved && ' ✅ All clearances received!'}
              </div>
              
              <button onClick={() => setSelectedStudent(mentee)}>
                View Details
              </button>
              
              {mentee.readyForMentorApproval && (
                <div className="mt-2">
                  <button onClick={() => handleMentorApprove(mentee.usn)} className="btn-primary">
                    Give Final Approval
                  </button>
                  <button onClick={() => handleMentorReject(mentee.usn)} className="btn-secondary">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          
          {selectedStudent && (
            <div className="modal">
              <h2>Clearance Details for {selectedStudent.studentName}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Teacher</th>
                    <th>Status</th>
                    <th>Approved At</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudent.clearanceDetails.map(detail => (
                    <tr key={detail.referenceId}>
                      <td>{detail.referenceType}</td>
                      <td>{detail.referenceId}</td>
                      <td>{detail.teacherEmployeeId}</td>
                      <td>{detail.status}</td>
                      <td>{detail.approvedAt?.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setSelectedStudent(null)}>Close</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
```
          </table>
          <button onClick={() => setSelectedStudent(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
```

### Admin Dashboard (Hall Ticket Generation)

```typescript
import { getStudentsReadyForHallTicket, downloadHallTicket, checkHallTicketEligibility } from '@/services/hallTicketService';

function AdminDashboard() {
  const { user } = useAuth(); // user.profileId is adminId
  const [students, setStudents] = useState<any[]>([]);
  
  // Assuming admin has departmentId in their profile
  const departmentId = 'CSE'; // Get from user.departmentId
  
  useEffect(() => {
    loadStudents();
  }, []);
  
  async function loadStudents() {
    const data = await getStudentsReadyForHallTicket(departmentId);
    setStudents(data);
  }
  
  async function handleGenerateHallTicket(usn: string) {
    try {
      // Check eligibility
      const eligibility = await checkHallTicketEligibility(usn);
      
      if (!eligibility.eligible) {
        alert(`Cannot generate hall ticket: ${eligibility.reason}`);
        return;
      }
      
      // Generate and download
      await downloadHallTicket(usn, user.profileId);
      alert('Hall ticket generated and downloaded!');
      loadStudents(); // Refresh list
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  }
  
  return (
    <div>
      <h1>Hall Ticket Generation</h1>
      <p>Students ready for hall ticket (Mentor approved)</p>
      
      <table>
        <thead>
          <tr>
            <th>USN</th>
            <th>Name</th>
            <th>Semester</th>
            <th>Section</th>
            <th>Mentor Approved</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.usn}>
              <td>{student.usn}</td>
              <td>{student.studentName}</td>
              <td>{student.semesterNumber}</td>
              <td>{student.section}</td>
              <td>{student.mentorApprovedAt.toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleGenerateHallTicket(student.usn)}>
                  Generate Hall Ticket
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {students.length === 0 && (
        <p>No students ready for hall ticket generation.</p>
      )}
    </div>
  );
}
```

## Security Rules Update

Add mentor approval and hall ticket checks to Firestore rules:

```javascript
// Allow mentors to update their mentee's mentor requests
match /no_due_requests/{requestId} {
  allow read: if request.auth != null;
  
  allow update: if request.auth != null && (
    // Teachers can approve/reject their assigned requests
    (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher' 
     && resource.data.teacherEmployeeId == getProfileId())
    
    // Mentors can approve/reject mentor requests for their mentees
    || (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher'
        && resource.data.referenceType == 'mentor'
        && resource.data.teacherEmployeeId == getProfileId()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'mentorApprovalStatus', 'mentorApprovedAt', 'mentorRejectionReason']))
    
    // Admins can update hall ticket generation fields
    || (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'department_admin'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['hallTicketGenerated', 'hallTicketGeneratedAt', 'hallTicketGeneratedBy', 'status']))
  );
}
```

## Summary

### Key Features
1. ✅ **Automatic Workflow Progression**: When all faculty approve → mentor request automatically becomes "pending_mentor_approval"
2. ✅ **Unified Faculty Dashboard**: Single Teacher Dashboard shows both subject teaching AND mentor responsibilities
3. ✅ **Mentor Review Section**: Faculty who are mentors see additional "My Mentees" section in their dashboard
4. ✅ **Final Mentor Approval**: Mentors give final approval after reviewing all clearances
5. ✅ **Hall Ticket PDF Generation**: Admin generates professional hall ticket with BNM Institute branding
6. ✅ **Complete Tracking**: Every stage is tracked in database with timestamps and status updates

### Important Clarification
**Mentors are Faculty Members:** There is NO separate mentor role or dashboard. Faculty members (role='faculty') can be assigned as mentors to students. When a faculty member is a mentor, they see both:
- Their subject teaching clearance requests
- Their mentees' final approval requests

All within the **same Teacher Dashboard**.

### Services Created
- **mentorApprovalService.ts**: Mentor approval logic and mentee clearance tracking (used by faculty in Teacher Dashboard)
- **hallTicketService.ts**: PDF generation with jsPDF, hall ticket formatting
- **noDueAutomationService.ts**: Updated with automatic mentor approval stage detection

### Database Fields Added
- `mentorApprovalStatus`: 'pending' | 'approved' | 'rejected'
- `mentorApprovedAt`: Timestamp
- `mentorRejectionReason`: string
- `hallTicketGenerated`: boolean
- `hallTicketGeneratedAt`: Timestamp
- `hallTicketGeneratedBy`: string (admin ID)

### Status Types
- `pending`: Waiting for faculty approval
- `approved`: Faculty approved
- `pending_mentor_approval`: All faculty approved, waiting for mentor (faculty) final approval
- `mentor_approved`: Mentor (faculty) approved
- `mentor_rejected`: Mentor (faculty) rejected
- `completed`: Hall ticket generated

---

**Next Steps:**
1. Implement unified TeacherDashboard.tsx with both subject approval AND mentor approval sections
2. Implement StudentDashboard.tsx and AdminDashboard.tsx
3. Install jsPDF: `npm install jspdf` ✅ Done
4. Deploy updated Firestore rules
4. Test complete workflow end-to-end
5. Train admins and mentors on new workflow
