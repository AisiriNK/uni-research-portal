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
      // Check if student exists and verify DOB
      const studentRef = doc(db, 'students', usn);
      const studentSnap = await getDoc(studentRef);
      
      if (!studentSnap.exists()) {
        throw new Error('Student not found. Please check your USN.');
      }
      
      const studentData = studentSnap.data();
      
      // Verify Date of Birth
      if (studentData.dateOfBirth !== dob) {
        throw new Error('Invalid Date of Birth. Please check and try again.');
      }
      
      // Generate email for Firebase Auth (usn@university.edu)
      const email = `${usn.toLowerCase()}@university.edu`;
      
      // Use DOB as password for Firebase Auth
      // If Firebase Auth account doesn't exist, create it
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, dob);
        const userData = await fetchUserData(userCredential.user);
        
        if (!userData) {
          throw new Error('User profile not found. Please contact support.');
        }
        
        setUser(userData);
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          // Create Firebase Auth account for student
          const userCredential = await createUserWithEmailAndPassword(auth, email, dob);
          
          // Create users reference document
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            email,
            role: 'student',
            profileId: usn,
            createdAt: serverTimestamp(),
          });
          
          const userData = await fetchUserData(userCredential.user);
          setUser(userData);
        } else {
          throw authError;
        }
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
