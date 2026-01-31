# 🔐 Admin Account Setup Guide

Since public account creation is disabled for security, the first admin account must be created manually.

## Method 1: Using Firebase Console (Easiest)

### Step 1: Create Authentication User
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** → **Users** tab
4. Click **"Add User"**
5. Enter credentials:
   - **Email**: `admin@bnmit.edu.in`
   - **Password**: `Admin@12345` (or your choice, min 8 chars)
6. Click **"Add User"**
7. **Copy the UID** from the newly created user (you'll need this)

### Step 2: Create Firestore Admin Profile
1. Go to **Firestore Database** in Firebase Console
2. Click **"+ Start Collection"**
3. Collection ID: `admins`
4. Click **"Next"**
5. Document ID: `ADMIN001`
6. Add these fields:

| Field | Type | Value |
|-------|------|-------|
| adminId | string | `ADMIN001` |
| name | string | `System Administrator` |
| email | string | `admin@bnmit.edu.in` |
| departmentId | string | `ALL` |
| role | string | `super_admin` |
| uid | string | `<paste UID from step 1>` |
| createdAt | timestamp | (click clock icon, select "now") |
| canManageAccounts | boolean | `true` |
| canGenerateHallTickets | boolean | `true` |
| canViewReports | boolean | `true` |

7. Click **"Save"**

### Step 3: Login
- **Email**: `admin@bnmit.edu.in`
- **Password**: `Admin@12345`

---

## Method 2: Using Setup Script (Automated)

### Step 1: Run Admin Creation Script
```powershell
# From project root
node create-admin.js
```

### Step 2: Follow Prompts
```
Enter Admin ID (e.g., ADMIN001): ADMIN001
Enter Admin Name: System Administrator
Enter Admin Email: admin@bnmit.edu.in
Enter Admin Password (min 8 chars): Admin@12345
Enter Department ID (or "ALL" for all departments): ALL
```

### Step 3: Save Credentials
The script will display your login credentials. **Save them securely!**

---

## Method 3: Manual Firestore + Firebase CLI

If you prefer command-line Firebase Admin SDK:

```javascript
// admin-setup.js
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function createAdmin() {
  try {
    // Create auth user
    const user = await auth.createUser({
      email: 'admin@bnmit.edu.in',
      password: 'Admin@12345',
      displayName: 'System Administrator'
    });

    // Create Firestore profile
    await db.collection('admins').doc('ADMIN001').set({
      adminId: 'ADMIN001',
      name: 'System Administrator',
      email: 'admin@bnmit.edu.in',
      departmentId: 'ALL',
      role: 'super_admin',
      uid: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      canManageAccounts: true,
      canGenerateHallTickets: true,
      canViewReports: true
    });

    console.log('✅ Admin created successfully!');
    console.log('Email:', user.email);
    console.log('UID:', user.uid);
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdmin();
```

---

## Default Admin Credentials

After setup, use these credentials to login:

```
Email: admin@bnmit.edu.in
Password: Admin@12345
```

**⚠️ IMPORTANT**: Change the password after first login!

---

## Creating Additional Admins

Once logged in as the first admin, you can create additional admin accounts:

### Option A: Using Admin Dashboard (UI)
1. Login as admin
2. Go to **Admin Dashboard** → **Account Management**
3. Click **"Add Admin"**
4. Fill in details:
   - Admin ID (e.g., `ADMIN002`)
   - Name
   - Email
   - Department (or "ALL")
   - Role (super_admin or admin)
5. Click **"Create Admin Account"**
6. Share the generated temporary password

### Option B: Using Admin Service (Programmatic)

```typescript
import { createAdminAccount } from '@/services/adminAccountManagementService';

const newAdmin = await createAdminAccount({
  adminId: 'ADMIN002',
  name: 'Department Admin',
  email: 'dept.admin@bnmit.edu.in',
  departmentId: 'CSE',
  role: 'admin',
  canManageAccounts: false,
  canGenerateHallTickets: true,
  canViewReports: true
}, 'ADMIN001'); // Creator's admin ID
```

---

## Admin Roles

### Super Admin (`super_admin`)
- Full system access
- Can create other admins
- Can manage all departments
- Can create student/teacher accounts
- Can generate hall tickets
- Can view all reports

### Department Admin (`admin`)
- Department-specific access
- Can create students/teachers in their department
- Can generate hall tickets for their department
- Can view reports for their department
- **Cannot** create other admins

---

## Security Best Practices

1. **Strong Passwords**: Use minimum 12 characters with mixed case, numbers, symbols
2. **Change Default Password**: Change `Admin@12345` immediately after first login
3. **Limited Super Admins**: Keep super_admin role to 1-2 trusted users
4. **Department Segregation**: Create department admins for distributed management
5. **Regular Audits**: Review admin accounts quarterly
6. **2FA Recommended**: Enable two-factor authentication in Firebase Console

---

## Troubleshooting

### "Email already exists"
- Email is already registered
- Check Firebase Auth users list
- Use a different email or delete the existing user

### "Weak password"
- Password must be at least 8 characters
- Include uppercase, lowercase, number, symbol

### "Permission denied"
- Check Firebase rules allow admin writes
- Verify service account has proper permissions

### "Cannot login"
- Verify email/password are correct
- Check if `uid` field in Firestore matches Auth UID
- Ensure `role` field is set to `super_admin` or `admin`

---

## Next Steps

After creating the admin account:

1. ✅ Login to admin dashboard
2. ✅ Change default password
3. ✅ Create teacher accounts (see [STUDENT_ACCOUNT_CREATION_GUIDE.md](./STUDENT_ACCOUNT_CREATION_GUIDE.md))
4. ✅ Create student accounts
5. ✅ Deploy Firebase rules: `firebase deploy --only firestore:rules`
6. ✅ Seed database: `node seed-nodue-database.js`

---

**Created**: January 2026  
**Institution**: BNM Institute of Technology  
**System**: No-Due Clearance & Hall Ticket Management
