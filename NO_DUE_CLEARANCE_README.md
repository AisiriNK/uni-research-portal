# No-Due Clearance System

## Overview

The No-Due Clearance System allows students to submit PDF documents to teachers for approval. Teachers can review, approve, or reject submissions with comments.

## Features

### For Students:
- ✅ Submit PDF documents to any teacher
- ✅ Add title, description, and category metadata
- ✅ Track submission status (Pending/Approved/Rejected)
- ✅ View teacher comments and feedback
- ✅ Access submitted documents anytime

### For Teachers:
- ✅ View all submissions from students
- ✅ Review pending and completed submissions
- ✅ Approve or reject with comments
- ✅ View student information with each submission
- ✅ Access submitted PDF documents

## How It Works

### Student Workflow:

1. **Navigate to No-Due Clearance**
   - Click "No-Due Clearance" in the sidebar

2. **Submit Document**
   - Select "Submit Document" tab
   - Choose a teacher from the dropdown
   - Select category (Library, Hostel, Department, etc.)
   - Enter a title and optional description
   - Upload PDF file (max 10MB)
   - Click "Submit Document"

3. **Track Status**
   - Switch to "My Submissions" tab
   - View all your submissions with status badges
   - Read teacher comments if rejected or approved
   - Download submitted PDFs

### Teacher Workflow:

1. **Navigate to No-Due Clearance**
   - Click "No-Due Clearance" in the sidebar

2. **Review Submissions**
   - View "Pending" tab for new submissions
   - See student details (name, reg no, email, dept)
   - Click "View Document" to open the PDF

3. **Approve or Reject**
   - Click "Approve" for valid submissions
   - Click "Reject" for submissions needing correction
   - Add comments (required for rejection)
   - Submit review

4. **View History**
   - Switch to "Reviewed" tab
   - See all approved and rejected submissions
   - Review your previous comments

## Technical Details

### Firebase Collections:

**noDueSubmissions**
```typescript
{
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  studentDept: string
  studentRegNo: string
  teacherId: string
  teacherName: string
  teacherEmail: string
  pdfUrl: string
  pdfName: string
  metadata: {
    title: string
    description: string
    category: string
  }
  status: 'pending' | 'approved' | 'rejected'
  teacherComments?: string
  reviewedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

### Firebase Storage:

PDF files are stored in:
```
no-due-submissions/{studentId}/{studentId}_{timestamp}_{filename}.pdf
```

### Security Rules:

- Students can create submissions only for themselves
- Students can read their own submissions
- Teachers can read submissions assigned to them
- Only assigned teachers can update (approve/reject) submissions
- No one can delete submissions (audit trail)

## Categories

- Library
- Hostel
- Department
- Accounts
- Examination Cell
- Training & Placement
- Other

## Limitations

- PDF files only
- Maximum file size: 10MB
- Submissions cannot be deleted (audit trail)
- Teachers can only review submissions assigned to them

## Dependencies

- Firebase Firestore (database)
- Firebase Storage (file storage)
- Firebase Authentication (user management)
- date-fns (date formatting)

## Components

1. **StudentSubmissionForm** - Form to submit new documents
2. **StudentSubmissionStatus** - View submission history
3. **TeacherApprovalDashboard** - Review and approve/reject submissions
4. **NoDueClearance** - Main component that integrates all views

## Service Functions

Located in `src/services/noDueService.ts`:

- `createSubmission()` - Create new submission
- `getStudentSubmissions()` - Get all student submissions
- `getTeacherSubmissions()` - Get all teacher submissions
- `updateSubmissionStatus()` - Approve/reject submission
- `getAllTeachers()` - Get list of all teachers
- `uploadSubmissionPDF()` - Upload PDF to Firebase Storage

## Future Enhancements

- Email notifications to teachers on new submissions
- Email notifications to students on approval/rejection
- Bulk approval for teachers
- Download all submissions as ZIP
- Advanced search and filters
- Analytics dashboard for administrators
- PDF preview in-app (without download)
- Support for multiple file types
- Re-submission after rejection
- Department-wise filtering for teachers

---

## Troubleshooting

### Students can't submit:
- Ensure you're logged in with a student account
- Check if PDF file is under 10MB
- Verify all required fields are filled

### Teachers can't see submissions:
- Ensure you're logged in with a teacher account
- Check if students have submitted to your account

### PDF upload fails:
- Check file size (must be < 10MB)
- Ensure file is PDF format
- Check internet connection
- Verify Firebase Storage is enabled

### Security rules error:
- Run `firebase deploy --only firestore:rules`
- Ensure Firebase CLI is installed and logged in
- Check Firestore security rules are properly configured

---

**Built with ❤️ for University Research Portal**
