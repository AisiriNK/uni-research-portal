# 🌱 Database Seeding Guide

This guide explains how to seed the No-Due Automation System database with initial data.

## Prerequisites

✅ Firebase project created  
✅ Firestore database enabled  
✅ `.env` file configured with Firebase credentials  
✅ `firebase-admin` package installed (`npm install firebase-admin`)

---

## Option 1: Using Firebase Service Account (Recommended)

### Step 1: Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **⚙️ Settings** → **Project Settings**
4. Navigate to **Service Accounts** tab
5. Click **"Generate new private key"**
6. Save the JSON file as `serviceAccountKey.json` in your project root

⚠️ **IMPORTANT**: Add `serviceAccountKey.json` to `.gitignore` (already done if using this template)

### Step 2: Update Seed Script

The seed script will automatically use the service account key if it exists:

```javascript
// seed-nodue-database.js looks for serviceAccountKey.json
import serviceAccount from './serviceAccountKey.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
});
```

### Step 3: Run Seed Script

```powershell
node seed-nodue-database.js
```

---

## Option 2: Using Firebase Login (Alternative)

If you don't want to download a service account key:

### Step 1: Login to Firebase CLI

```powershell
firebase login
```

### Step 2: Set Application Default Credentials

```powershell
# Set environment variable
$env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\firebase\YOUR_EMAIL_application_default_credentials.json"
```

### Step 3: Run Seed Script

```powershell
node seed-nodue-database.js
```

---

## Option 3: Temporary Rules Relaxation (Quick & Dirty)

**⚠️ NOT RECOMMENDED for production** - Only use for quick local testing

### Step 1: Temporarily Relax Firestore Rules

Edit `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORARY: Allow all writes for seeding
    match /{document=**} {
      allow read, write: if true;  // ⚠️ INSECURE - for seeding only
    }
  }
}
```

### Step 2: Deploy Rules

```powershell
firebase deploy --only firestore:rules
```

### Step 3: Use Client SDK Seed Script

Create `seed-client.js` (using Firebase client SDK):

```javascript
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// ... rest of seeding logic
```

### Step 4: Run Seed Script

```powershell
node seed-client.js
```

### Step 5: **RESTORE PRODUCTION RULES IMMEDIATELY**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Restore your secure production rules here
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

```powershell
firebase deploy --only firestore:rules
```

---

## What Gets Seeded

The seed script creates:

### 1. Academic Context
- Current semester: **2025-26 (odd)**
- Collection: `academic_context`
- Document: `current`

### 2. Common Clearance Types (5 types)
- Library Clearance
- Fee Clearance
- Sports Clearance
- Certificate Verification
- Mentor Clearance

### 3. Sample Teachers (7 teachers)
- `LIB001` - Librarian (institution-wide)
- `ACC001` - Accounts Head (institution-wide)
- `SPO001` - Sports Coordinator (institution-wide)
- `ADM001` - Admin Officer (institution-wide)
- `CS001` - Dr. John Doe (CS faculty)
- `CS002` - Prof. Jane Smith (CS faculty)
- `CS003` - Dr. Mentor Kumar (CS mentor)

### 4. Common Clearance Mappings (4 mappings)
- Library → LIB001
- Fees → ACC001
- Sports → SPO001
- Certificate → ADM001

### 5. Sample Curriculum (4 subjects)
- CS Department, Batch 2023, Semester 5:
  - `CS501` - Data Structures (core)
  - `CS502` - Database Management Systems (core)
  - `CS503` - Operating Systems (core)
  - `CS9OE1` - Machine Learning (open elective)

### 6. Core Subject Teacher Mappings (3 mappings)
- CS, Batch 2023, Sem 5, Section A:
  - CS501 → CS002 (Prof. Jane Smith)
  - CS502 → CS001 (Dr. John Doe)
  - CS503 → CS001 (Dr. John Doe)

### 7. Open Elective Offerings (1 offering)
- CS, Batch 2023, Sem 5:
  - CS9OE1 → CS002 (Prof. Jane Smith)

### 8. Sample Students (2 students)
- `1CS21CS001` - Alice Johnson (mentor: CS003)
- `1CS21CS002` - Bob Williams (mentor: CS003)

### 9. Student Elective Choices (2 choices)
- 1CS21CS001 → CS9OE1
- 1CS21CS002 → CS9OE1

---

## Verification

After seeding, verify in Firebase Console:

```powershell
# Check Firestore collections
firebase firestore:collections
```

Or manually in Firebase Console → Firestore Database:
- ✓ `academic_context` (1 document)
- ✓ `common_clearance_types` (5 documents)
- ✓ `teachers` (7 documents)
- ✓ `common_clearance_mapping` (4 documents)
- ✓ `curriculum` (4 documents)
- ✓ `core_subject_teacher_mapping` (3 documents)
- ✓ `open_elective_offerings` (1 document)
- ✓ `students` (2 documents)
- ✓ `student_elective_choice` (2 documents)

---

## Troubleshooting

### Error: "PERMISSION_DENIED: Missing or insufficient permissions"
**Cause**: Firestore security rules are blocking writes  
**Solution**: Use Option 1 (service account key) or Option 2 (Firebase login with ADC)

### Error: "auth/invalid-api-key"
**Cause**: Missing or invalid `.env` file  
**Solution**: Ensure `.env` has `VITE_FIREBASE_PROJECT_ID` and other Firebase configs

### Error: "Could not load the default credentials"
**Cause**: Firebase Admin SDK can't find credentials  
**Solution**: 
- Download service account key (Option 1)
- Or run `firebase login` and set GOOGLE_APPLICATION_CREDENTIALS (Option 2)

### Error: "Document already exists"
**Cause**: Database already seeded  
**Solution**: 
- This is normal - seed script uses `.set()` which overwrites
- Or manually delete collections in Firebase Console before re-seeding

### Error: "Cannot find module './serviceAccountKey.json'"
**Cause**: Service account key file not found  
**Solution**: Download from Firebase Console or use Option 2/3

---

## Clean Database (Reset)

To remove all seeded data:

### Manual (Firebase Console)
1. Go to Firestore Database
2. Delete each collection individually

### Script (TODO)
```powershell
node clean-database.js
```

---

## Next Steps

After seeding:

1. ✅ Create admin account → See [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md)
2. ✅ Deploy Firestore rules → `firebase deploy --only firestore:rules`
3. ✅ Test authentication → Login with admin account
4. ✅ Test no-due workflow → Create student requests

---

**Created**: January 2026  
**Institution**: BNM Institute of Technology  
**System**: No-Due Clearance & Hall Ticket Management
