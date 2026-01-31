# Report Upload Issue - Troubleshooting & Fix Guide

## Issue
Students cannot upload reports in the Student Dashboard.

## Root Causes & Solutions

### 1. Firebase Storage Not Enabled

**Problem:** Firebase Storage might not be enabled in your Firebase project.

**Solution:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **Storage** in the left sidebar
4. If you see "Get Started" button, click it to enable Storage
5. Choose your Storage location (keep default or select closest region)

### 2. Storage Rules Not Deployed

**Problem:** The storage rules file exists locally but hasn't been deployed to Firebase.

**Solution:**
Deploy the storage rules:

```bash
# From project root
firebase deploy --only storage:rules
```

Or deploy everything:
```bash
firebase deploy
```

### 3. Missing Environment Variables

**Problem:** The `.env` file is missing or has incorrect Firebase Storage configuration.

**Check your `.env` file:**
```bash
# Windows PowerShell
cat .env
```

**Required variables:**
```env
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com  ← THIS ONE IS CRITICAL
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Get correct values:**
1. Go to Firebase Console → Project Settings → General
2. Scroll to "Your apps" section
3. Find your web app, click the config icon (</>) 
4. Copy the `storageBucket` value
5. Add it to your `.env` file

### 4. Storage Rules Issue

**Problem:** Storage rules might be too restrictive or have syntax errors.

**Current rules in `storage.rules`:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // No-Due Submission PDFs
    match /no-due-submissions/{studentId}/{fileName} {
      // Students can upload their own PDFs (max 10MB)
      allow write: if request.auth != null 
                   && request.auth.uid == studentId
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType == 'application/pdf';
      
      // Any authenticated user can read submissions (students and teachers)
      allow read: if request.auth != null;
    }
    
    // Deny all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**Alternative (more permissive for testing):**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /no-due-submissions/{allPaths=**} {
      // Allow authenticated users to read/write
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠️ **Note:** Use the permissive rules only for testing, then revert to the secure rules.

### 5. Authentication Issue

**Problem:** User might not be properly authenticated when attempting upload.

**Check authentication state:**

Add debug logging to `StudentSubmissionForm.tsx`:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Add this debug logging
  console.log('User:', user);
  console.log('User Profile:', userProfile);
  console.log('Auth UID:', user?.uid);
  
  if (!user || !userProfile) {
    setError('User information not available');
    return;
  }
  
  // ... rest of code
};
```

### 6. CORS Issues

**Problem:** Browser blocking Firebase Storage requests due to CORS.

**Solution:**
Firebase Storage should have CORS enabled by default, but if needed:

Create `cors.json`:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT"],
    "maxAgeSeconds": 3600
  }
]
```

Deploy CORS config:
```bash
gsutil cors set cors.json gs://your-project-id.appspot.com
```

## Complete Fix Steps (Run in Order)

### Step 1: Verify Firebase Storage is Enabled

```bash
# Check Firebase config
firebase projects:list
firebase use your-project-id
```

### Step 2: Verify Environment Variables

```bash
# Check if .env file exists
ls .env

# If not, copy from example
cp .env.example .env

# Edit .env and add your Firebase config
notepad .env  # or code .env
```

**Make sure `VITE_FIREBASE_STORAGE_BUCKET` is set correctly!**

### Step 3: Deploy Storage Rules

```bash
# Deploy storage rules
firebase deploy --only storage:rules

# Expected output:
# ✔  storage: rules file storage.rules compiled successfully
# ✔  storage: released rules storage.rules to firebase.storage/your-project-id.appspot.com
```

### Step 4: Restart Development Server

```bash
# Stop the current dev server (Ctrl+C)
# Restart it to pick up .env changes
npm run dev
```

### Step 5: Test Upload

1. Log in as a student
2. Navigate to "No Due Clearance" or the upload form
3. Try uploading a PDF file
4. Check browser console for errors (F12 → Console tab)

## Common Error Messages & Fixes

### Error: "storage/unauthorized"

**Cause:** Storage rules blocking the upload.

**Fix:**
1. Check storage rules are deployed: `firebase deploy --only storage:rules`
2. Temporarily use permissive rules for testing
3. Verify user is authenticated: Check `auth.currentUser` in console

### Error: "storage/object-not-found"

**Cause:** Trying to read a file that doesn't exist.

**Fix:** This is normal for new uploads, ignore this error.

### Error: "storage/unauthenticated"

**Cause:** User not logged in or auth token expired.

**Fix:**
1. Log out and log back in
2. Clear browser cache and cookies
3. Check if Firebase Auth is working: `firebase.auth().currentUser`

### Error: "storage/quota-exceeded"

**Cause:** Firebase Storage free tier quota exceeded (5GB).

**Fix:**
1. Go to Firebase Console → Storage
2. Check storage usage
3. Upgrade to Blaze plan (pay-as-you-go) if needed

### Error: "Failed to fetch" or Network Error

**Cause:** 
- Firebase Storage not enabled
- Incorrect storage bucket URL
- Network connectivity issue

**Fix:**
1. Enable Storage in Firebase Console
2. Verify `VITE_FIREBASE_STORAGE_BUCKET` is correct
3. Check internet connection

## Debugging Commands

### Check Firebase Project Status
```bash
firebase projects:list
firebase use
```

### Check Current Storage Rules
```bash
firebase storage:rules:get
```

### View Storage Files (requires Firebase CLI logged in)
```bash
firebase storage:list
```

### Check Environment Variables Are Loaded
Add to your component:
```typescript
console.log('Storage Bucket:', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
```

## Verify Firebase Storage Configuration

Add this test function to verify storage is working:

```typescript
// Add to StudentSubmissionForm.tsx for testing
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/config/firebase';

async function testStorageConnection() {
  try {
    console.log('Testing Firebase Storage...');
    console.log('Storage instance:', storage);
    console.log('Storage bucket:', storage.app.options.storageBucket);
    console.log('Current user:', auth.currentUser);
    
    // Try to create a test reference
    const testRef = ref(storage, 'test/test.txt');
    console.log('Test ref created:', testRef);
    
    // Try to upload a small test blob
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    await uploadBytes(testRef, testBlob);
    console.log('✅ Upload successful!');
    
    // Try to get download URL
    const url = await getDownloadURL(testRef);
    console.log('✅ Download URL:', url);
    
    return true;
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    return false;
  }
}

// Call in useEffect to test on component mount
useEffect(() => {
  testStorageConnection();
}, []);
```

## Quick Test Checklist

- [ ] Firebase Storage enabled in Console
- [ ] `.env` file exists with correct `VITE_FIREBASE_STORAGE_BUCKET`
- [ ] Storage rules deployed (`firebase deploy --only storage:rules`)
- [ ] Dev server restarted after `.env` changes
- [ ] User is logged in (check `auth.currentUser`)
- [ ] Browser console shows no CORS errors
- [ ] File is PDF and under 10MB
- [ ] Internet connection working

## Still Not Working?

### Get Detailed Error Information

Update the upload error handler in `StudentSubmissionForm.tsx`:

```typescript
} catch (err) {
  console.error('Full error object:', err);
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  console.error('Error details:', JSON.stringify(err, null, 2));
  
  let errorMessage = 'Failed to submit. Please try again.';
  
  if (err.code === 'storage/unauthorized') {
    errorMessage = 'Storage access denied. Check storage rules.';
  } else if (err.code === 'storage/unauthenticated') {
    errorMessage = 'Please log in again.';
  } else if (err.code === 'storage/quota-exceeded') {
    errorMessage = 'Storage quota exceeded.';
  }
  
  setError(errorMessage);
}
```

### Contact Support

If issue persists, provide:
1. Browser console screenshot (F12 → Console)
2. Network tab screenshot (F12 → Network)
3. Firebase project ID
4. Error message from console

---

## Most Likely Fix

**90% of upload issues are caused by:**

1. **Storage bucket not configured in `.env`**
2. **Storage rules not deployed**

**Run these 3 commands:**

```bash
# 1. Verify .env has storage bucket
cat .env | grep STORAGE_BUCKET

# 2. Deploy storage rules
firebase deploy --only storage:rules

# 3. Restart dev server
npm run dev
```

Then try uploading again!
