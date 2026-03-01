import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { 
  User, 
  UserContextType, 
  SignupData, 
  UserRole,
  Student,
  Teacher,
  DepartmentAdmin
} from '@/types/user';

const AuthContext = createContext<UserContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const normalizeDobInput = (dobInput: string): string => {
    const trimmed = dobInput.trim();
    if (!trimmed) {
      return trimmed;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/');
      return `${year}-${month}-${day}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return trimmed;
  };

  /**
   * Fetch user data from Firestore using new schema
   * 
   * CHANGES:
   * - Students collection uses usn as document ID
   * - Teachers collection uses employeeId as document ID
   * - Admins collection uses adminId as document ID
   * - No more UID-based document IDs (except for users collection)
   */
  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      // Get role from users collection (uid-based)
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.error('User document not found');
        return null;
      }

      const userData = userDocSnap.data();
      const role = userData.role as UserRole;

      // Get detailed profile from role-specific collection
      // Note: We store the profile ID (usn/employeeId/adminId) in users collection
      const profileId = userData.profileId as string;
      
      if (!profileId) {
        console.error('Profile ID not found in user document');
        return null;
      }

      let profileData: any;
      
      if (role === 'student') {
        const profileDocRef = doc(db, 'students', profileId);
        const profileDocSnap = await getDoc(profileDocRef);
        
        if (!profileDocSnap.exists()) {
          console.error('Student profile not found');
          return null;
        }
        
        profileData = profileDocSnap.data();
        
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          name: profileData.name,
          role: 'student',
          usn: profileData.usn,
          dateOfBirth: profileData.dateOfBirth,
          departmentId: profileData.departmentId,
          batchYear: profileData.batchYear,
          section: profileData.section,
          mentorEmployeeId: profileData.mentorEmployeeId,
          createdAt: profileData.createdAt?.toDate() || new Date(),
          // Legacy aliases
          dept: profileData.departmentId,
          regNo: profileData.usn,
        } as Student;
      } else if (role === 'teacher') {
        const profileDocRef = doc(db, 'teachers', profileId);
        const profileDocSnap = await getDoc(profileDocRef);
        
        if (!profileDocSnap.exists()) {
          console.error('Teacher profile not found');
          return null;
        }
        
        profileData = profileDocSnap.data();
        
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          name: profileData.name,
          role: 'teacher',
          employeeId: profileData.employeeId,
          departmentId: profileData.departmentId,
          teacherRole: profileData.role, // Teacher's specific role (faculty/mentor/etc)
          createdAt: profileData.createdAt?.toDate() || new Date(),
          // Legacy aliases
          empId: profileData.employeeId,
          dept: profileData.departmentId,
        } as Teacher;
      } else if (role === 'department_admin' || role === 'admin') {
        const profileDocRef = doc(db, 'admins', profileId);
        const profileDocSnap = await getDoc(profileDocRef);
        
        if (!profileDocSnap.exists()) {
          console.error('Admin profile not found');
          return null;
        }
        
        profileData = profileDocSnap.data();
        
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          name: profileData.name || 'Admin',
          role: 'department_admin',
          adminId: profileData.adminId,
          departmentId: profileData.departmentId,
          createdAt: profileData.createdAt?.toDate() || new Date(),
          // Legacy alias
          dept: profileData.departmentId,
        } as DepartmentAdmin;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Signup function - DISABLED
   * 
   * Account creation is disabled for all users.
   * Only administrators can create accounts using administrative tools.
   * 
   * Students: Use studentAccountService.ts (admin only)
   * Teachers: Admin creates via Firebase Console or admin panel
   * Admins: Super admin creates via Firebase Console
   */
  const signup = async (userData: SignupData): Promise<void> => {
    // Block all account creation attempts
    throw new Error('Account creation is disabled. Please contact your system administrator to create an account.');
  };

  /**
   * Student login using USN and Date of Birth
   * Students use USN+DOB instead of email/password
   */
  const loginStudent = async (usn: string, dob: string): Promise<void> => {
    if (!usn || !dob) {
      throw new Error('USN and Date of Birth are required');
    }

    try {
      const normalizedDob = normalizeDobInput(dob);

      // Check if student exists and verify DOB
      const studentRef = doc(db, 'students', usn);
      const studentSnap = await getDoc(studentRef);
      
      if (!studentSnap.exists()) {
        throw new Error('Student not found. Please check your USN.');
      }
      
      const studentData = studentSnap.data();
      
      // Verify Date of Birth
      if (studentData.dateOfBirth !== normalizedDob) {
        throw new Error('Invalid Date of Birth. Please check and try again.');
      }
      
      // Generate canonical login email (fallback) and collect historical emails to try
      const generatedEmail = `${usn.toLowerCase()}@university.edu`;
      const preferredEmail = studentData.email?.toLowerCase();
      const authEmails = Array.from(
        new Set(
          [preferredEmail, generatedEmail].filter(
            (email): email is string => Boolean(email)
          )
        )
      );
      const password = normalizedDob;

      const attemptLogin = async (emailToUse: string) => {
        const credential = await signInWithEmailAndPassword(auth, emailToUse, password);
        const profile = await fetchUserData(credential.user);

        if (!profile) {
          throw new Error('User profile not found. Please contact support.');
        }

        setUser(profile);
      };

      let lastAuthError: any = null;

      for (const emailToTry of authEmails) {
        try {
          await attemptLogin(emailToTry as string);
          return;
        } catch (authError: any) {
          lastAuthError = authError;
          if (authError.code === 'auth/user-not-found') {
            continue;
          }
          throw authError;
        }
      }

      if (lastAuthError?.code === 'auth/user-not-found' || !authEmails.length) {
        const creationEmail = preferredEmail || generatedEmail;
        const userCredential = await createUserWithEmailAndPassword(auth, creationEmail, password);

        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: creationEmail,
          role: 'student',
          profileId: usn,
          createdAt: serverTimestamp(),
        });

        const userData = await fetchUserData(userCredential.user);
        setUser(userData);
        return;
      }
      
      if (lastAuthError) {
        throw lastAuthError;
      }
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid Date of Birth. Please check and try again.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed login attempts. Please try again later');
      } else {
        throw new Error(error.message || 'Login failed. Please try again');
      }
    }
  };

  // Login function (for teachers and admins)
  const login = async (email: string, password: string): Promise<void> => {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await fetchUserData(userCredential.user);
      
      if (!userData) {
        throw new Error('User profile not found. Please contact support.');
      }
      
      setUser(userData);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password');
      } else if (error.code === 'auth/invalid-credential') {
        throw new Error('Invalid credentials. Please check your email and password');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed login attempts. Please try again later');
      } else {
        throw new Error(error.message || 'Login failed. Please try again');
      }
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error: any) {
      throw new Error(error.message || 'Logout failed. Please try again');
    }
  };

  const value: UserContextType = {
    user,
    userProfile: user, // userProfile is the same as user (contains all profile data)
    loading,
    login,
    loginStudent, // Student login with USN+DOB
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
