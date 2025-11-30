# 🔥 Firebase Authentication System - Complete Package

## 📦 What's Included

This is a **production-ready** Firebase Authentication system with role-based access control, designed specifically for the University Research Portal.

---

## ✨ Features

### Authentication
- ✅ **Email/Password Signup** with role selection
- ✅ **Email/Password Login** with credential validation
- ✅ **Secure Logout** with session cleanup
- ✅ **Persistent Sessions** across page refreshes
- ✅ **Auto-redirect** based on user roles

### Authorization
- ✅ **Role-Based Access Control (RBAC)** - Student & Teacher roles
- ✅ **Protected Routes** - Prevent unauthorized access
- ✅ **Route-level role checking** - Students can't access teacher routes and vice versa
- ✅ **Automatic role detection** on login

### Data Management
- ✅ **Firestore Integration** - Secure cloud database
- ✅ **Separate Collections** - `/students/{uid}` and `/teachers/{uid}`
- ✅ **User Profiles** - Name, email, department, role-specific IDs
- ✅ **Security Rules** - Users can only access their own data

### User Experience
- ✅ **Modern UI** - Clean, responsive design with shadcn/ui
- ✅ **Loading States** - Spinner animations during operations
- ✅ **Error Handling** - User-friendly error messages
- ✅ **Form Validation** - Email format, password strength, required fields
- ✅ **Role-based Dashboards** - Unique dashboards for students and teachers

---

## 📁 File Structure

```
uni-research-portal/
├── src/
│   ├── config/
│   │   └── firebase.ts                  ✅ Firebase initialization
│   ├── contexts/
│   │   └── AuthContext.tsx              ✅ Global auth state
│   ├── types/
│   │   └── user.ts                      ✅ TypeScript definitions
│   ├── components/
│   │   └── ProtectedRoute.tsx           ✅ Route protection
│   ├── pages/
│   │   ├── Login.tsx                    ✅ Login page
│   │   ├── Signup.tsx                   ✅ Signup page
│   │   ├── StudentDashboard.tsx         ✅ Student dashboard
│   │   └── TeacherDashboard.tsx         ✅ Teacher dashboard
│   └── App.tsx                          ✅ Routes with AuthProvider
├── firestore.rules                       ✅ Security rules
├── firebase.json                         ✅ Firebase config
├── firestore.indexes.json                ✅ Firestore indexes
├── .env.example                          ✅ Environment template
├── FIREBASE_SETUP.md                     ✅ Complete setup guide
├── FIREBASE_QUICK_REFERENCE.md           ✅ Developer reference
├── IMPLEMENTATION_SUMMARY.md             ✅ Implementation details
├── QUICKSTART.md                         ✅ Quick start guide
├── verify-firebase-setup.js              ✅ Setup verification
└── FIREBASE_AUTH_README.md               ✅ This file
```

---

## 🚀 Quick Start

### 1. Install Firebase SDK

```bash
npm install firebase
```

### 2. Setup Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your Firebase credentials
```

Get your Firebase credentials from:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project or select existing
3. Add a Web app
4. Copy the config values to `.env`

### 3. Deploy Firestore Rules

```bash
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login
firebase login

# Initialize (if not done)
firebase init

# Deploy security rules
firebase deploy --only firestore:rules
```

### 4. Start Development

```bash
npm run dev
```

Visit http://localhost:5173/signup to create your first user!

---

## 🔐 Database Schema

### Firestore Collections

#### `/users/{uid}`
Role reference for quick lookups.

```typescript
{
  email: string
  role: 'student' | 'teacher'
  createdAt: Timestamp
}
```

#### `/students/{uid}`
Detailed student profiles.

```typescript
{
  name: string
  email: string
  dept: string
  regNo: string
  createdAt: Timestamp
}
```

#### `/teachers/{uid}`
Detailed teacher profiles.

```typescript
{
  name: string
  email: string
  dept: string
  empId: string
  createdAt: Timestamp
}
```

---

## 🛡️ Security Rules

The system implements comprehensive Firestore security rules:

### Users Collection
- ✅ Users can read only their own role document
- ✅ Role cannot be changed after creation
- ✅ Creation allowed only during signup

### Students Collection
- ✅ Students can read/write only their own profile
- ✅ Email cannot be changed
- ✅ Only authenticated users can create profiles

### Teachers Collection
- ✅ Teachers can read/write only their own profile
- ✅ Email cannot be changed
- ✅ Only authenticated users can create profiles

### Additional Collections
- ✅ Subjects: Public read, teacher-only write
- ✅ No-Due Clearance: Role-based access
- ✅ Approvals: Student can read own, teachers can read all

---

## 💻 Usage Examples

### Using Auth in Components

```typescript
import { useAuth } from '@/contexts/AuthContext';

const MyComponent = () => {
  const { user, loading, login, logout } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please login</div>;
  
  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <p>Role: {user.role}</p>
      {user.role === 'student' && <p>Reg No: {user.regNo}</p>}
      {user.role === 'teacher' && <p>Emp ID: {user.empId}</p>}
      <button onClick={logout}>Logout</button>
    </div>
  );
};
```

### Protected Routes

```typescript
<Route
  path="/student-dashboard"
  element={
    <ProtectedRoute allowedRoles={['student']}>
      <StudentDashboard />
    </ProtectedRoute>
  }
/>
```

### Login

```typescript
const handleLogin = async () => {
  try {
    await login('user@example.com', 'password123');
    // User is logged in, auto-redirect based on role
  } catch (error) {
    console.error(error.message);
  }
};
```

### Signup

```typescript
const handleSignup = async () => {
  try {
    await signup({
      email: 'student@example.com',
      password: 'password123',
      name: 'John Doe',
      dept: 'Computer Science',
      role: 'student',
      regNo: 'CS2024001',
    });
    // User is registered and logged in
  } catch (error) {
    console.error(error.message);
  }
};
```

---

## 🧪 Testing

### Create Test Users

**Student Account:**
```
Email: student@test.com
Password: test123
Name: Test Student
Department: Computer Science
Registration No: CS2024001
Role: Student
```

**Teacher Account:**
```
Email: teacher@test.com
Password: test123
Name: Test Teacher
Department: Computer Science
Employee ID: EMP2024001
Role: Teacher
```

### Verify Setup

Run the verification script:

```bash
node verify-firebase-setup.js
```

---

## 🔧 Configuration

### Environment Variables

Required in `.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

⚠️ **Never commit `.env` to version control!** It's already in `.gitignore`.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **FIREBASE_SETUP.md** | Complete step-by-step setup guide with Firebase project creation |
| **FIREBASE_QUICK_REFERENCE.md** | Quick reference for developers with code examples |
| **IMPLEMENTATION_SUMMARY.md** | Detailed implementation overview and architecture |
| **QUICKSTART.md** | Get started in 3 steps |
| **This File** | Overview and main documentation |

---

## 🐛 Troubleshooting

### Common Issues

**Issue: "Cannot find module 'firebase'"**
```bash
npm install firebase
```

**Issue: "Missing or insufficient permissions"**
```bash
firebase deploy --only firestore:rules
```

**Issue: "Environment variables not loading"**
- Restart dev server after changing `.env`
- Ensure variables start with `VITE_`
- Check for typos

**Issue: "User profile not found after signup"**
- Check Firebase Console → Firestore
- Verify security rules are deployed
- Check browser console for errors

### Debug Mode

Enable Firebase debug logging in `src/config/firebase.ts`:

```typescript
import { setLogLevel } from 'firebase/app';
setLogLevel('debug');
```

---

## 🎯 Routes

| Path | Access | Description |
|------|--------|-------------|
| `/` | Public | Home page |
| `/login` | Public | Login page |
| `/signup` | Public | Registration page |
| `/student-dashboard` | Students only | Student dashboard |
| `/teacher-dashboard` | Teachers only | Teacher dashboard |

---

## ✅ Validation Rules

### Email
- Must be valid email format
- Checked against Firebase Auth

### Password
- Minimum 6 characters
- No maximum (Firebase handles this)

### Required Fields

**Students:**
- Email, Password, Name, Department, Registration Number, Role

**Teachers:**
- Email, Password, Name, Department, Employee ID, Role

---

## 🔒 Best Practices Implemented

1. **Environment Variables** - All secrets in `.env`
2. **Type Safety** - Full TypeScript coverage
3. **Error Handling** - Comprehensive try-catch blocks
4. **Loading States** - User feedback during operations
5. **Security Rules** - Firestore access control
6. **Validation** - Client-side and server-side
7. **Separation of Concerns** - Clean architecture
8. **Code Reusability** - Shared components and hooks

---

## 🚧 Future Enhancements

Potential features you can add:

- [ ] Password reset via email
- [ ] Email verification
- [ ] Profile picture upload
- [ ] Profile editing
- [ ] Admin dashboard
- [ ] Two-factor authentication
- [ ] Social login (Google, GitHub)
- [ ] Activity logging
- [ ] Remember me checkbox
- [ ] Account deletion

---

## 🆘 Support

If you encounter issues:

1. Check this documentation
2. Review `FIREBASE_SETUP.md` for setup issues
3. Run `node verify-firebase-setup.js`
4. Check Firebase Console for errors
5. Review browser console for client errors

---

## 📝 License

This implementation is part of the University Research Portal project.

---

## 🎉 Ready to Use!

Your Firebase Authentication system is **production-ready** with:

- ✅ Secure authentication
- ✅ Role-based access control
- ✅ Protected routes
- ✅ User dashboards
- ✅ Firestore security rules
- ✅ Complete documentation

**Next Steps:**
1. Install Firebase: `npm install firebase`
2. Configure `.env` with your Firebase credentials
3. Deploy security rules: `firebase deploy --only firestore:rules`
4. Start dev server: `npm run dev`
5. Create your first user at `/signup`

**Happy coding! 🚀**
