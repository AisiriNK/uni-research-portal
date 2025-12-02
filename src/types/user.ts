// User Type Definitions

export type UserRole = 'student' | 'teacher' | 'reprography_admin';

export interface BaseUser {
  uid: string;
  email: string;
  name: string;
  dept: string;
  role: UserRole;
  createdAt: Date;
}

export interface Student extends BaseUser {
  role: 'student';
  regNo: string;
}

export interface Teacher extends BaseUser {
  role: 'teacher';
  empId: string;
}

export interface ReprographyAdmin extends BaseUser {
  role: 'reprography_admin';
  empId: string;
}

export type User = Student | Teacher | ReprographyAdmin;

export interface UserContextType {
  user: User | null;
  userProfile: User | null; // Alias for user, contains full profile data
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => Promise<void>;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  dept: string;
  role: UserRole;
  regNo?: string;
  empId?: string;
}
