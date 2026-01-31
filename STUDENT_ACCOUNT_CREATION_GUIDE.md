# Student Account Creation Guide (Admin Only)

## Overview

Students **CANNOT** create their own accounts. Only department admins can create student accounts using the Student Account Creation Service.

## Why USN + Date of Birth?

Traditional email/password login is problematic for students:
- Students forget passwords
- Email addresses change
- Password resets are cumbersome

USN + DOB login provides:
- ✅ No password to remember
- ✅ Date of Birth is permanent and known to students
- ✅ Institutional control (admin creates accounts)
- ✅ Prevents unauthorized account creation

## Authentication Flow

### For Students
1. Admin creates student account with USN and DOB
2. Student logs in using:
   - **USN**: `1CS21CS001`
   - **Date of Birth**: `2003-05-15` (YYYY-MM-DD format)
3. System verifies USN exists in `students` collection
4. System checks if provided DOB matches stored DOB
5. System creates/uses Firebase Auth account (behind the scenes)
6. Student is logged in and redirected to dashboard

### For Teachers/Admins
- Continue using email/password login (unchanged)

## How to Create Student Accounts

### Option 1: Individual Account Creation

Use the `createStudentAccount()` function in your admin panel:

```typescript
import { createStudentAccount } from '@/services/studentAccountService';

// In your admin component
async function handleCreateStudent() {
  try {
    const usn = await createStudentAccount({
      usn: '1CS21CS001',
      name: 'John Doe',
      dateOfBirth: '2003-05-15',  // YYYY-MM-DD format
      departmentId: 'CSE',
      batchYear: 2021,
      section: 'A',
      mentorEmployeeId: 'CS001',
      email: '1cs21cs001@university.edu'  // Optional, auto-generates if not provided
    });
    
    console.log('Student created:', usn);
  } catch (error) {
    console.error('Failed to create student:', error.message);
  }
}
```

### Option 2: Batch Account Creation

For creating multiple students at once (e.g., from CSV import):

```typescript
import { createStudentAccountsBatch } from '@/services/studentAccountService';

async function handleBatchCreate() {
  const students = [
    {
      usn: '1CS21CS001',
      name: 'John Doe',
      dateOfBirth: '2003-05-15',
      departmentId: 'CSE',
      batchYear: 2021,
      section: 'A',
      mentorEmployeeId: 'CS001'
    },
    {
      usn: '1CS21CS002',
      name: 'Jane Smith',
      dateOfBirth: '2003-08-22',
      departmentId: 'CSE',
      batchYear: 2021,
      section: 'A',
      mentorEmployeeId: 'CS001'
    }
    // ... more students
  ];
  
  const result = await createStudentAccountsBatch(students);
  
  console.log(`Created ${result.successCount} students`);
  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
  }
}
```

## Student Login Implementation

### In Login.tsx

```typescript
import { useAuth } from '@/contexts/AuthContext';

function LoginPage() {
  const { loginStudent, login } = useAuth();
  const [userType, setUserType] = useState<'student' | 'staff'>('student');
  
  // For students
  const handleStudentLogin = async (usn: string, dob: string) => {
    try {
      await loginStudent(usn, dob);
      // Redirect to student dashboard
    } catch (error) {
      console.error('Login failed:', error.message);
    }
  };
  
  // For teachers/admins
  const handleStaffLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      // Redirect based on role
    } catch (error) {
      console.error('Login failed:', error.message);
    }
  };
  
  return (
    <div>
      {/* Toggle between student and staff login */}
      <select value={userType} onChange={(e) => setUserType(e.target.value as any)}>
        <option value="student">Student</option>
        <option value="staff">Teacher/Admin</option>
      </select>
      
      {userType === 'student' ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          handleStudentLogin(usn, dob);
        }}>
          <input type="text" placeholder="USN (e.g., 1CS21CS001)" value={usn} onChange={...} />
          <input type="date" placeholder="Date of Birth" value={dob} onChange={...} />
          <button type="submit">Login</button>
        </form>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          handleStaffLogin(email, password);
        }}>
          <input type="email" placeholder="Email" value={email} onChange={...} />
          <input type="password" placeholder="Password" value={password} onChange={...} />
          <button type="submit">Login</button>
        </form>
      )}
    </div>
  );
}
```

## Important Functions

### createStudentAccount()
Creates a single student account.

**Parameters:**
- `usn`: Student's USN (e.g., "1CS21CS001")
- `name`: Full name
- `dateOfBirth`: YYYY-MM-DD format (e.g., "2003-05-15")
- `departmentId`: Department code (e.g., "CSE")
- `batchYear`: Admission year (e.g., 2021)
- `section`: Section letter (e.g., "A")
- `mentorEmployeeId`: Assigned mentor's employee ID
- `email`: Optional, auto-generates as `usn@university.edu`

**Returns:** Created student's USN

**Throws:**
- If USN already exists
- If DOB format is invalid
- If required fields are missing

### createStudentAccountsBatch()
Creates multiple student accounts.

**Parameters:**
- Array of student data objects

**Returns:** 
```typescript
{
  successCount: number;
  errors: Array<{ usn: string; error: string }>;
}
```

### updateStudentDOB()
Updates a student's date of birth (use if student forgets DOB or correction needed).

**Parameters:**
- `usn`: Student's USN
- `newDOB`: New date of birth (YYYY-MM-DD)

### validateStudentCredentials()
Validates if USN exists and DOB matches (used during login).

**Parameters:**
- `usn`: Student's USN
- `dob`: Date of birth to verify

**Returns:** `true` if valid, `false` otherwise

## Date of Birth Format

**Always use YYYY-MM-DD format:**
- ✅ Correct: `2003-05-15`
- ❌ Wrong: `15/05/2003`
- ❌ Wrong: `05-15-2003`
- ❌ Wrong: `2003/05/15`

## Behind the Scenes (Technical Details)

### Firestore Structure
```
students/{usn}
  - usn: "1CS21CS001"
  - name: "John Doe"
  - dateOfBirth: "2003-05-15"
  - departmentId: "CSE"
  - batchYear: 2021
  - section: "A"
  - mentorEmployeeId: "CS001"
  - email: "1cs21cs001@university.edu"
  - createdAt: timestamp

users/{firebase_auth_uid}
  - email: "1cs21cs001@university.edu"
  - role: "student"
  - profileId: "1CS21CS001"  // Points to students/{usn}
  - createdAt: timestamp
```

### Firebase Authentication
- Email: Auto-generated as `{usn}@university.edu`
- Password: Student's date of birth (YYYY-MM-DD)
- This is handled automatically by the system
- Students never see or use the email/password

### Login Process (loginStudent method)
```typescript
async loginStudent(usn: string, dob: string) {
  // 1. Verify student exists in Firestore
  const studentDoc = await getDoc(doc(db, 'students', usn));
  if (!studentDoc.exists()) throw new Error('Invalid USN');
  
  // 2. Verify DOB matches
  if (studentDoc.data().dateOfBirth !== dob) throw new Error('Invalid Date of Birth');
  
  // 3. Generate email (usn@university.edu)
  const email = `${usn.toLowerCase()}@university.edu`;
  
  // 4. Try to login with Firebase Auth
  try {
    await signInWithEmailAndPassword(auth, email, dob);
  } catch (error) {
    // If account doesn't exist in Firebase Auth, create it
    if (error.code === 'auth/user-not-found') {
      await createUserWithEmailAndPassword(auth, email, dob);
      // Create users reference document
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        email, role: 'student', profileId: usn
      });
    }
  }
}
```

## Sample Students (Seeded)

Two sample students are created by `seed-nodue-database.js`:

| USN | Name | DOB | Department | Batch | Section | Mentor |
|-----|------|-----|------------|-------|---------|--------|
| 1CS21CS001 | Amit Kumar | 2003-05-15 | CSE | 2021 | A | CS001 |
| 1CS21CS002 | Priya Sharma | 2003-08-22 | CSE | 2021 | A | CS001 |

**Test Login:**
- USN: `1CS21CS001`
- DOB: `2003-05-15`

## Security Considerations

1. **No Self-Registration**: Students cannot create their own accounts, preventing:
   - Fake accounts
   - Incorrect data entry
   - Unauthorized access

2. **Institutional Control**: Admin has full control over:
   - Who gets an account
   - Student data accuracy
   - Account lifecycle management

3. **DOB as Password**: While DOB is used as the Firebase Auth password:
   - It's only visible during admin creation
   - Students don't know the underlying password mechanism
   - System verifies DOB against Firestore before auth
   - DOB is permanent and known to students

4. **Access Control**: Firestore rules ensure:
   - Students can only access their own data
   - Teachers can only access assigned students' requests
   - Admins have department-wide access

## Admin Panel Implementation TODO

Create an admin page with the following features:

1. **Single Student Creation Form**
   - Input fields for all student data
   - DOB picker (date input)
   - Submit button calling `createStudentAccount()`

2. **Batch Upload**
   - CSV upload button
   - Parse CSV and call `createStudentAccountsBatch()`
   - Display success/error summary

3. **Student Management**
   - List all students in department
   - Search by USN
   - Edit student details (except USN)
   - Update DOB if needed (for password reset)

4. **Sample CSV Format**
```csv
usn,name,dateOfBirth,departmentId,batchYear,section,mentorEmployeeId
1CS21CS001,John Doe,2003-05-15,CSE,2021,A,CS001
1CS21CS002,Jane Smith,2003-08-22,CSE,2021,A,CS001
```

## Troubleshooting

### "Invalid USN" Error
- Check if student account was created by admin
- Verify USN spelling (case-sensitive)

### "Invalid Date of Birth" Error
- Check DOB format (must be YYYY-MM-DD)
- Verify DOB matches what admin entered during creation

### "Student already exists" Error
- USN is already registered
- Check existing students before creating

### DOB Update Required
- Admin must call `updateStudentDOB(usn, newDOB)`
- Student should then use new DOB to login

## Next Steps

1. ✅ Student schema updated with `dateOfBirth` field
2. ✅ `loginStudent(usn, dob)` method implemented in AuthContext
3. ✅ Student signup disabled
4. ✅ Student Account Service created
5. ⏳ Update Login.tsx with student/staff toggle
6. ⏳ Create Admin Panel for student account creation
7. ⏳ Test student login flow
8. ⏳ Deploy and train admins

---

**Ready to implement:** The authentication system is now complete and secure. Next step is updating the Login page UI to support USN+DOB input for students.
