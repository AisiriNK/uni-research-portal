# Firebase Authentication Setup Guide

## 🚀 Complete Firebase Authentication System

This guide will help you set up Firebase Authentication with role-based access control for the University Research Portal.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Project Setup](#firebase-project-setup)
3. [Environment Configuration](#environment-configuration)
4. [Install Dependencies](#install-dependencies)
5. [Deploy Firestore Security Rules](#deploy-firestore-security-rules)
6. [Testing the Application](#testing-the-application)
7. [Architecture Overview](#architecture-overview)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js (v16 or higher)
- npm or bun package manager
- A Google account for Firebase
- Basic understanding of React and TypeScript

---

## Firebase Project Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Enter your project name (e.g., `uni-research-portal`)
4. Disable Google Analytics (optional)
5. Click **Create Project**

### Step 2: Enable Authentication

1. In Firebase Console, navigate to **Build > Authentication**
2. Click **Get Started**
3. Click on **Sign-in method** tab
4. Enable **Email/Password** provider
5. Save changes

### Step 3: Create Firestore Database

1. Navigate to **Build > Firestore Database**
2. Click **Create Database**
3. Choose **Start in test mode** (we'll deploy security rules later)
4. Select your preferred region
5. Click **Enable**

### Step 4: Register Your Web App

1. In Firebase Console, click the **Web** icon (</>) to add a web app
2. Register your app with a nickname (e.g., `Research Portal Web`)
3. Check **Also set up Firebase Hosting** (optional)
4. Click **Register app**
5. Copy the Firebase configuration object - you'll need this for `.env`

---

## Environment Configuration

### Step 1: Create .env File

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

### Step 2: Add Firebase Configuration

Open `.env` and add your Firebase credentials from the previous step:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

⚠️ **Important**: Never commit `.env` to version control. The `.env.example` file should already be in your `.gitignore`.

---

## Install Dependencies

Install Firebase SDK:

```bash
npm install firebase
```

Or if using bun:

```bash
bun add firebase
```

---

## Deploy Firestore Security Rules

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

### Step 3: Initialize Firebase (if not done)

```bash
firebase init
```

Select:
- Firestore
- Hosting (optional)

Choose your existing Firebase project.

### Step 4: Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

This will deploy the `firestore.rules` file to your Firebase project.

---

## Testing the Application

### Step 1: Start Development Server

```bash
npm run dev
```

Or with bun:

```bash
bun run dev
```

### Step 2: Test User Registration

1. Navigate to `http://localhost:5173/signup`
2. Fill in the signup form:
   - Select role (Student or Teacher)
   - Enter name, email, department
   - Enter registration number (for students) or employee ID (for teachers)
   - Enter password (minimum 6 characters)
3. Click **Sign Up**
4. You should be redirected to the appropriate dashboard

### Step 3: Test Login

1. Navigate to `http://localhost:5173/login`
2. Enter your email and password
3. Click **Sign In**
4. Verify you're redirected to the correct dashboard based on your role

### Step 4: Test Logout

1. On the dashboard, click the **Logout** button
2. Verify you're redirected to the login page
3. Confirm you can't access protected routes without logging in

---

## Architecture Overview

### File Structure

```
src/
├── config/
│   └── firebase.ts              # Firebase initialization
├── contexts/
│   └── AuthContext.tsx          # Global auth state management
├── types/
│   └── user.ts                  # TypeScript type definitions
├── components/
│   └── ProtectedRoute.tsx       # Route protection component
├── pages/
│   ├── Login.tsx                # Login page
│   ├── Signup.tsx               # Signup page
│   ├── StudentDashboard.tsx     # Student dashboard
│   └── TeacherDashboard.tsx     # Teacher dashboard
└── App.tsx                      # Main app with routes
```

### Data Model

#### Collections Structure

**users/{uid}**
```typescript
{
  email: string
  role: 'student' | 'teacher'
  createdAt: Timestamp
}
```

**students/{uid}**
```typescript
{
  name: string
  email: string
  dept: string
  regNo: string
  createdAt: Timestamp
}
```

**teachers/{uid}**
```typescript
{
  name: string
  email: string
  dept: string
  empId: string
  createdAt: Timestamp
}
```

### Authentication Flow

1. **Signup**:
   - User fills registration form
   - Firebase Auth creates account
   - User document created in `/users/{uid}` with role
   - Profile document created in role-specific collection
   - User redirected to role-specific dashboard

2. **Login**:
   - User enters credentials
   - Firebase Auth validates
   - User role fetched from `/users/{uid}`
   - Profile data fetched from role collection
   - Redirect based on role

3. **Logout**:
   - Firebase Auth session cleared
   - User state reset to null
   - Redirect to login page

---

## Security Best Practices

### 1. Environment Variables

✅ **DO**:
- Use environment variables for all Firebase config
- Never commit `.env` to version control
- Use different Firebase projects for dev/staging/prod

❌ **DON'T**:
- Hard-code Firebase credentials
- Share your API keys publicly
- Use production credentials in development

### 2. Firestore Security Rules

The deployed security rules ensure:
- Users can only read/write their own profiles
- Role-based access control for sensitive operations
- Public data (like subjects) is read-only for students
- No-due clearance requires authentication

### 3. Client-Side Validation

- Email format validation
- Password strength checks (minimum 6 characters)
- Required field validation
- Role-specific field requirements

### 4. Error Handling

All operations include comprehensive error handling:
- Firebase Auth errors (duplicate email, weak password, etc.)
- Network errors
- Missing profile data
- Invalid credentials

---

## Troubleshooting

### Common Issues

#### 1. "Firebase: Error (auth/api-key-not-valid)"

**Solution**: Check your `.env` file and ensure `VITE_FIREBASE_API_KEY` is correct.

#### 2. "Missing or insufficient permissions"

**Solution**: Deploy Firestore security rules using `firebase deploy --only firestore:rules`

#### 3. "User profile not found after signup"

**Solution**: Check Firebase Console → Firestore Database to ensure both collections are created correctly.

#### 4. Components not loading

**Solution**: Ensure all dependencies are installed:
```bash
npm install
```

#### 5. Environment variables not loading

**Solution**: 
- Restart development server after changing `.env`
- Ensure variables are prefixed with `VITE_`
- Check for typos in variable names

### Debug Mode

Enable Firebase debug logging in `src/config/firebase.ts`:

```typescript
import { setLogLevel } from 'firebase/app';
setLogLevel('debug');
```

---

## Features Implemented

### ✅ Authentication
- Email/password signup
- Email/password login
- Logout functionality
- Session persistence

### ✅ Role-Based Access
- Student role
- Teacher role
- Role-specific collections
- Protected routes

### ✅ User Profile Management
- Separate collections for students and teachers
- Role-specific fields (regNo for students, empId for teachers)
- Profile data fetching on login

### ✅ Security
- Firestore security rules
- Client-side validation
- Protected routes
- Error handling

### ✅ UI/UX
- Modern, clean design
- Loading states
- Error messages
- Responsive layout
- Role-based navigation

---

## Next Steps

### Optional Enhancements

1. **Password Reset**:
   - Add "Forgot Password" functionality
   - Use Firebase `sendPasswordResetEmail()`

2. **Email Verification**:
   - Require email verification before access
   - Use Firebase `sendEmailVerification()`

3. **Profile Updates**:
   - Allow users to update their profiles
   - Add profile picture upload

4. **Admin Panel**:
   - Create an admin role
   - Manage users and approvals

5. **Advanced Security**:
   - Add reCAPTCHA to signup
   - Implement rate limiting
   - Add two-factor authentication

---

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Router Documentation](https://reactrouter.com/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication Best Practices](https://firebase.google.com/docs/auth/best-practices)

---

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Review Firebase Console for errors
3. Check browser console for error messages
4. Verify all environment variables are set correctly

---

**🎉 Your Firebase Authentication system is now ready to use!**
