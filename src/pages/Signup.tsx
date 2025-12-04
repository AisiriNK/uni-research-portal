import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { SignupData, UserRole } from '@/types/user';

const Signup: React.FC = () => {
  const [formData, setFormData] = useState<SignupData>({
    email: '',
    password: '',
    name: '',
    dept: '',
    role: 'student',
    regNo: '',
    branch: '',
    empId: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signup, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      const redirectPath = user.role === 'student' ? '/student-dashboard' : '/teacher-dashboard';
      navigate(redirectPath, { replace: true });
    }
  }, [user, navigate]);

  const handleChange = (field: keyof SignupData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    // Check required fields
    if (!formData.email || !formData.password || !formData.name || !formData.dept || !formData.role) {
      setError('Please fill in all required fields');
      return false;
    }

    // Email validation
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Student email domain validation
    if (formData.role === 'student' && !formData.email.endsWith('@bnmit.in')) {
      setError('Students must use @bnmit.in email address');
      return false;
    }

    // Password validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    // Confirm password
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    // Role-specific validation
    if (formData.role === 'student' && !formData.regNo) {
      setError('Registration number is required for students');
      return false;
    }

    if (formData.role === 'teacher' && !formData.empId) {
      setError('Employee ID is required for teachers');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await signup(formData);
      // Navigation will be handled by the useEffect above
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="space-y-4">
          {/* Logo and Brand */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">U</span>
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                UniFlow
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                University Research Portal
              </p>
            </div>
          </div>
          
          {/* Welcome Message */}
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
            <CardDescription>
              Sign up to get started with the portal
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">I am a *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleChange('role', value as UserRole)}
                disabled={loading}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="reprography_admin">Reprography Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={loading}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept">Department/Branch *</Label>
              <Select
                value={formData.dept}
                onValueChange={(value) => {
                  handleChange('dept', value);
                  if (formData.role === 'student') {
                    handleChange('branch', value);
                  }
                }}
                disabled={loading}
              >
                <SelectTrigger id="dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                  <SelectItem value="Electronics">Electronics & Communication</SelectItem>
                  <SelectItem value="Electrical">Electrical & Electronics</SelectItem>
                  <SelectItem value="Mechanical">Mechanical Engineering</SelectItem>
                  <SelectItem value="Civil">Civil Engineering</SelectItem>
                  <SelectItem value="Information Science">Information Science</SelectItem>
                  <SelectItem value="AI & ML">Artificial Intelligence & Machine Learning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === 'student' && (
              <div className="space-y-2">
                <Label htmlFor="regNo">Registration Number *</Label>
                <Input
                  id="regNo"
                  type="text"
                  placeholder="Enter your registration number"
                  value={formData.regNo}
                  onChange={(e) => handleChange('regNo', e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            )}

            {formData.role === 'teacher' && (
              <div className="space-y-2">
                <Label htmlFor="empId">Employee ID *</Label>
                <Input
                  id="empId"
                  type="text"
                  placeholder="Enter your employee ID"
                  value={formData.empId}
                  onChange={(e) => handleChange('empId', e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            )}

            {formData.role === 'reprography_admin' && (
              <div className="space-y-2">
                <Label htmlFor="empId">Employee ID *</Label>
                <Input
                  id="empId"
                  type="text"
                  placeholder="Enter your employee ID"
                  value={formData.empId}
                  onChange={(e) => handleChange('empId', e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Signup;
