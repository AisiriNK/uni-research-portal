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
import { User, UserContextType, SignupData, UserRole } from '@/types/user';

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

  // Fetch user data from Firestore
  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      // Get role from users collection
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.error('User document not found');
        return null;
      }

      const userData = userDocSnap.data();
      const role = userData.role as UserRole;

      // Get detailed profile from role-specific collection
      let roleCollectionName = 'students';
      if (role === 'teacher') roleCollectionName = 'teachers';
      if (role === 'reprography_admin') roleCollectionName = 'reprography_admins';
      
      const profileDocRef = doc(db, roleCollectionName, firebaseUser.uid);
      const profileDocSnap = await getDoc(profileDocRef);

      if (!profileDocSnap.exists()) {
        console.error('Profile document not found');
        return null;
      }

      const profileData = profileDocSnap.data();

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        name: profileData.name,
        dept: profileData.dept,
        role: role,
        createdAt: profileData.createdAt?.toDate() || new Date(),
        ...(role === 'student' ? { 
          regNo: profileData.regNo,
          branch: profileData.branch,
          year: profileData.year,
          department: profileData.dept // Add department alias
        } : { empId: profileData.empId }),
      } as User;
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

  // Signup function
  const signup = async (userData: SignupData): Promise<void> => {
    const { email, password, name, dept, role, regNo, empId } = userData;

    // Validation
    if (!email || !password || !name || !dept || !role) {
      throw new Error('All required fields must be filled');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    if (role === 'student' && !regNo) {
      throw new Error('Registration number is required for students');
    }

    if ((role === 'teacher' || role === 'reprography_admin') && !empId) {
      throw new Error('Employee ID is required for teachers and admins');
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Create user role reference document
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        email,
        role,
        createdAt: serverTimestamp(),
      });

      // Create detailed profile in role-specific collection
      let roleCollectionName = 'students';
      if (role === 'teacher') roleCollectionName = 'teachers';
      if (role === 'reprography_admin') roleCollectionName = 'reprography_admins';
      
      const profileData = {
        name,
        email,
        dept,
        createdAt: serverTimestamp(),
        ...(role === 'student' ? { regNo, branch: userData.branch || dept } : { empId }),
      };

      await setDoc(doc(db, roleCollectionName, firebaseUser.uid), profileData);

      // Fetch and set user data
      const newUser = await fetchUserData(firebaseUser);
      setUser(newUser);
    } catch (error: any) {
      // Handle Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email format');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak');
      } else {
        throw new Error(error.message || 'Signup failed. Please try again');
      }
    }
  };

  // Login function
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
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
