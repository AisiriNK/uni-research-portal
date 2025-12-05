# Firebase Authentication - Quick Reference

## 🔐 Using Auth in Components

### Import the Auth Hook

```typescript
import { useAuth } from '@/contexts/AuthContext';
```

### Access User Data

```typescript
const { user, loading, login, signup, logout } = useAuth();

// Check if user is logged in
if (user) {
  console.log(user.name);
  console.log(user.email);
  console.log(user.role); // 'student' or 'teacher'
  
  // Role-specific data
  if (user.role === 'student') {
    console.log(user.regNo);
  } else {
    console.log(user.empId);
  }
}
```

### Login Example

```typescript
const handleLogin = async () => {
  try {
    await login('user@example.com', 'password123');
    // User is now logged in
  } catch (error) {
    console.error(error.message);
  }
};
```

### Signup Example

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

### Logout Example

```typescript
const handleLogout = async () => {
  try {
    await logout();
    // User is logged out
  } catch (error) {
    console.error(error.message);
  }
};
```

---

## 🛡️ Protected Routes

### Protect a Route

```typescript
<Route
  path="/protected"
  element={
    <ProtectedRoute>
      <ProtectedComponent />
    </ProtectedRoute>
  }
/>
```

### Role-Based Protection

```typescript
// Only students can access
<Route
  path="/student-only"
  element={
    <ProtectedRoute allowedRoles={['student']}>
      <StudentOnlyComponent />
    </ProtectedRoute>
  }
/>

// Only teachers can access
<Route
  path="/teacher-only"
  element={
    <ProtectedRoute allowedRoles={['teacher']}>
      <TeacherOnlyComponent />
    </ProtectedRoute>
  }
/>

// Both can access
<Route
  path="/both"
  element={
    <ProtectedRoute allowedRoles={['student', 'teacher']}>
      <BothComponent />
    </ProtectedRoute>
  }
/>
```

---

## 🗄️ Firestore Operations

### Read User Profile

```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const getUserProfile = async (userId: string, role: 'student' | 'teacher') => {
  const collectionName = role === 'student' ? 'students' : 'teachers';
  const docRef = doc(db, collectionName, userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
};
```

### Update User Profile

```typescript
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const updateProfile = async (userId: string, role: 'student' | 'teacher', data: any) => {
  const collectionName = role === 'student' ? 'students' : 'teachers';
  const docRef = doc(db, collectionName, userId);
  await updateDoc(docRef, data);
};
```

### Create a Document

```typescript
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

const createDocument = async (collectionName: string, data: any) => {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};
```

---

## 🔒 Security Rules Examples

### Allow User to Read Only Their Data

```javascript
allow read: if request.auth != null && request.auth.uid == userId;
```

### Allow Only Teachers to Write

```javascript
allow write: if request.auth != null 
              && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
```

### Allow Public Read, Authenticated Write

```javascript
allow read: if true;
allow write: if request.auth != null;
```

---

## 🎨 UI Components

### Show Content Based on Auth State

```tsx
const MyComponent = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <Loader2 className="animate-spin" />;
  }
  
  if (!user) {
    return <div>Please log in</div>;
  }
  
  return <div>Welcome, {user.name}!</div>;
};
```

### Show Content Based on Role

```tsx
const MyComponent = () => {
  const { user } = useAuth();
  
  return (
    <div>
      {user?.role === 'student' && (
        <StudentContent />
      )}
      
      {user?.role === 'teacher' && (
        <TeacherContent />
      )}
    </div>
  );
};
```

### Conditional Navigation

```tsx
const MyComponent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (user) {
      const path = user.role === 'student' 
        ? '/student-dashboard' 
        : '/teacher-dashboard';
      navigate(path);
    }
  }, [user, navigate]);
  
  return <div>Redirecting...</div>;
};
```

---

## 🧪 Testing Users

### Create Test Users

Use the signup page or Firebase Console to create test users:

**Student Account**:
- Email: `student@test.com`
- Password: `test123`
- Name: `Test Student`
- Dept: `Computer Science`
- Reg No: `CS2024001`
- Role: `student`

**Teacher Account**:
- Email: `teacher@test.com`
- Password: `test123`
- Name: `Test Teacher`
- Dept: `Computer Science`
- Emp ID: `EMP2024001`
- Role: `teacher`

---

## 🐛 Common Patterns

### Check Auth Before Action

```typescript
const handleAction = async () => {
  if (!user) {
    alert('Please log in first');
    navigate('/login');
    return;
  }
  
  // Proceed with action
};
```

### Redirect After Login

```typescript
const handleLogin = async (email: string, password: string) => {
  try {
    await login(email, password);
    // AuthContext will update user state
  } catch (error) {
    console.error(error);
  }
};

// In component
useEffect(() => {
  if (user) {
    const redirectPath = user.role === 'student' 
      ? '/student-dashboard' 
      : '/teacher-dashboard';
    navigate(redirectPath);
  }
}, [user]);
```

### Show Error Messages

```typescript
const [error, setError] = useState('');

const handleSubmit = async () => {
  setError('');
  try {
    await someAction();
  } catch (err: any) {
    setError(err.message || 'An error occurred');
  }
};

return (
  <div>
    {error && <Alert variant="destructive">{error}</Alert>}
  </div>
);
```

---

## 📱 TypeScript Types

### User Types

```typescript
import { User, UserRole } from '@/types/user';

// Use in component
const MyComponent = () => {
  const { user } = useAuth();
  
  const checkRole = (role: UserRole) => {
    return user?.role === role;
  };
  
  return <div>{checkRole('student') ? 'Student' : 'Teacher'}</div>;
};
```

### Signup Data Type

```typescript
import { SignupData } from '@/types/user';

const userData: SignupData = {
  email: 'test@example.com',
  password: 'password123',
  name: 'John Doe',
  dept: 'Computer Science',
  role: 'student',
  regNo: 'CS2024001',
};
```

---

## 🚀 Quick Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Build for production
npm run build
```

---

## 📖 Additional Resources

- **Full Setup Guide**: See `FIREBASE_SETUP.md`
- **Firebase Docs**: https://firebase.google.com/docs
- **React Router**: https://reactrouter.com/
- **shadcn/ui**: https://ui.shadcn.com/
