# Print Request System

## Overview

The Print Request System allows students to send **approved report submissions** to a Reprography Admin for printing. Students can specify print preferences, track print status, and receive notifications when their prints are completed.

## Features

### For Students
- ✅ **Send to Print** button appears only for **approved** submissions
- ✅ Specify print options:
  - Color mode (Black & White / Color)
  - Print sides (Single / Double sided)
  - Binding type (None / Staple / Soft Bind / Spiral Bind)
  - Number of copies (1-10)
  - Additional notes for the reprography team
- ✅ Track print status (Pending / In Progress / Completed / Cancelled)
- ✅ View print completion notifications in submissions view
- ✅ One print request per approved submission

### For Reprography Admins
- ✅ Dedicated dashboard at `/reprography-dashboard`
- ✅ View all print requests in organized tabs:
  - Pending requests
  - In-progress prints
  - Completed prints
  - Cancelled requests
- ✅ Real-time stats: Pending, In Progress, Completed, Total
- ✅ Actions:
  - Start printing (Pending → In Progress)
  - Mark completed (In Progress → Completed)
  - Cancel request
  - Add admin notes
  - View/download PDF
- ✅ Full student details (name, reg no, dept, email)
- ✅ Complete print specifications displayed

## User Workflow

### Student Workflow

1. **Submit Document to Teacher**
   - Navigate to "Report Submission"
   - Fill submission form and upload PDF
   - Submit to teacher for approval

2. **Wait for Approval**
   - Teacher reviews and approves the submission

3. **Send to Print**
   - Once approved, "Send to Print" button appears
   - Click the button
   - Fill print request form:
     - Choose color mode
     - Select print sides
     - Choose binding type
     - Specify number of copies
     - Add any special instructions
   - Submit print request

4. **Track Print Status**
   - View print status badge in "My Submissions"
   - Statuses:
     - 🟡 **Pending** - Waiting in queue
     - 🔵 **In Progress** - Currently being printed
     - 🟢 **Completed** - Print ready for collection
     - ⚫ **Cancelled** - Request cancelled

### Reprography Admin Workflow

1. **Login as Reprography Admin**
   - Email/password authentication
   - Automatically redirected to `/reprography-dashboard`

2. **View Print Queue**
   - Dashboard shows stats cards
   - Tabs organize requests by status

3. **Process Requests**
   - **Pending Tab**: Click "Start Printing"
   - **In Progress Tab**: Click "Mark Completed"
   - Add admin notes (optional)
   - Download PDF to print

4. **Manage Queue**
   - Cancel requests if needed
   - Track completion with timestamps

## File Structure

```
src/
├── types/
│   └── print.ts                    # TypeScript interfaces
├── services/
│   └── printService.ts             # Firestore CRUD operations
├── components/
│   ├── PrintRequestForm.tsx        # Student print options dialog
│   ├── StudentSubmissionStatus.tsx # Updated with print button
│   └── ReprographyDashboard.tsx    # Admin print queue dashboard
└── pages/
    └── ReprographyAdmin.tsx        # Admin page wrapper
```

## Database Schema

### Collection: `printRequests`

```typescript
{
  id: string;
  
  // Submission reference
  submissionId: string;
  submissionTitle: string;
  pdfUrl: string;
  pdfName: string;
  
  // Student info
  studentId: string;
  studentName: string;
  studentRegNo: string;
  studentDept: string;
  studentEmail: string;
  
  // Print options
  printOptions: {
    colorMode: 'bw' | 'color';
    sides: 'single' | 'double';
    binding: 'none' | 'staple' | 'soft-bind' | 'spiral-bind';
    copies: number;
    additionalNotes?: string;
  };
  
  // Status tracking
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Admin info
  processedBy?: string;
  adminNotes?: string;
}
```

## Security Rules

```javascript
// Firestore Rules
match /printRequests/{requestId} {
  // Students can read their own print requests
  // Reprography admins can read all requests
  allow read: if isAuthenticated() && (
    resource.data.studentId == request.auth.uid ||
    getUserRole() == 'reprography_admin'
  );
  
  // Only students can create print requests
  allow create: if isAuthenticated() 
                && getUserRole() == 'student'
                && request.resource.data.studentId == request.auth.uid;
  
  // Only reprography admins can update status
  allow update: if isAuthenticated() && getUserRole() == 'reprography_admin';
  
  // No deletions (maintain audit trail)
  allow delete: if false;
}
```

## Setup Instructions

### 1. Create Reprography Admin Account

```bash
# Go to signup page
http://localhost:8080/signup

# Fill the form:
Role: Reprography Admin
Name: Admin Name
Email: admin@example.com
Department: Reprography
Employee ID: ADMIN001
Password: ******
```

### 2. Test the System

**As Student:**
1. Login as student
2. Submit a document to teacher
3. Wait for teacher approval
4. Click "Send to Print" on approved submission
5. Fill print options and submit

**As Reprography Admin:**
1. Login as reprography_admin
2. View pending requests
3. Click "Start Printing"
4. Mark as completed when done
5. Student sees "Print Completed" status

## API Functions

### Student Functions
```typescript
// Create print request
createPrintRequest(studentData, requestData): Promise<string>

// Get student's print requests
getStudentPrintRequests(studentId): Promise<PrintRequest[]>

// Check if submission has print request
getPrintRequestBySubmission(submissionId): Promise<PrintRequest | null>
```

### Admin Functions
```typescript
// Get all print requests
getAllPrintRequests(): Promise<PrintRequest[]>

// Update print status
updatePrintRequestStatus(requestId, updateData): Promise<void>
```

## Status Flow

```
Pending → In Progress → Completed
   ↓           ↓
Cancelled   Cancelled
```

## Print Options Reference

### Color Mode
- **Black & White**: Standard monochrome printing
- **Color**: Full color printing (may incur additional charges)

### Print Sides
- **Single Sided**: Print on one side only
- **Double Sided**: Print on both sides (duplex)

### Binding Types
- **None**: Loose pages
- **Staple**: Simple staple binding (1-50 pages)
- **Soft Bind**: Thermal/glue binding (50-200 pages)
- **Spiral Bind**: Coil/spiral binding (any page count)

### Copies
- Range: 1-10 copies per request
- For bulk orders, contact reprography admin directly

## Notifications

### Student Notifications
- ✅ Print request submitted
- ✅ Print started (status changes to In Progress)
- ✅ Print completed (ready for collection)
- ❌ Print cancelled (with admin notes)

### Admin View
- Real-time request count in dashboard stats
- Color-coded status badges
- Timestamp tracking for all actions

## Future Enhancements

- 📧 Email notifications for status changes
- 🔔 In-app push notifications
- 💳 Cost calculation for color/binding
- 📊 Print history analytics
- 🖨️ Bulk operations (approve multiple requests)
- 📦 Batch download PDFs as ZIP
- 🔍 Advanced search and filters
- 📱 Mobile-responsive print queue

## Troubleshooting

### "Send to Print" button not showing
- Ensure submission is **approved** by teacher
- Only approved submissions can be sent to print

### Print request fails
- Check Firebase Storage is enabled
- Verify Firestore rules are deployed
- Ensure user has `student` role

### Reprography dashboard empty
- Verify you're logged in as `reprography_admin` role
- Check if any print requests exist in Firestore

### Cannot update print status
- Verify logged in as reprography admin
- Check Firestore security rules
- Ensure Firebase is properly configured

## Support

For issues or questions:
1. Check Firebase Console for errors
2. Review browser console logs
3. Verify Firestore rules are deployed
4. Ensure all user roles are correctly assigned

---

**Print System Version**: 1.0.0  
**Last Updated**: December 2, 2025
