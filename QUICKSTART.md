# Quick Start - Firebase Authentication

## 🚀 Get Started in 3 Steps

### 1️⃣ Install Firebase

```bash
npm install firebase
# or
bun add firebase
```

### 2️⃣ Configure Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your Firebase credentials
# Get these from: https://console.firebase.google.com/
```

### 3️⃣ Deploy & Run

```bash
# Deploy Firestore security rules
firebase login
firebase deploy --only firestore:rules

# Start the development server
npm run dev
```

---

## 📍 Access Points

After starting the server, visit:

- **Signup**: http://localhost:5173/signup
- **Login**: http://localhost:5173/login
- **Student Dashboard**: http://localhost:5173/student-dashboard (protected)
- **Teacher Dashboard**: http://localhost:5173/teacher-dashboard (protected)

---

## 🔐 Test Accounts

Create these test accounts via the signup page:

**Student Account**:
- Email: `student@test.com`
- Password: `test123` (or your choice)
- Name: `Test Student`
- Department: `Computer Science`
- Registration No: `CS2024001`
- Role: Student

**Teacher Account**:
- Email: `teacher@test.com`
- Password: `test123` (or your choice)
- Name: `Test Teacher`
- Department: `Computer Science`
- Employee ID: `EMP2024001`
- Role: Teacher

---

## ✅ Verification Script

Run this to check your setup:

```bash
node verify-firebase-setup.js
```

---

## 📚 Full Documentation

- **Complete Setup Guide**: [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
- **Quick Reference**: [FIREBASE_QUICK_REFERENCE.md](./FIREBASE_QUICK_REFERENCE.md)
- **Implementation Details**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

---

## 🆘 Need Help?

### Common Issues

**"Firebase SDK not found"**
```bash
npm install firebase
```

**"Missing or insufficient permissions"**
```bash
firebase deploy --only firestore:rules
```

**Environment variables not loading**
- Restart dev server after changing `.env`
- Ensure variables start with `VITE_`

---

## 🎯 What's Included

✅ Email/Password Authentication  
✅ Role-based Access (Student/Teacher)  
✅ Protected Routes  
✅ User Dashboards  
✅ Firestore Security Rules  
✅ Complete TypeScript Support  
✅ Modern UI Components  

---

**Ready to start? Run `npm install firebase` and follow step 2!** 🚀
