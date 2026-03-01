import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Mail, GraduationCap, Building2 } from 'lucide-react';
import { StudentApprovalStatus } from '@/components/StudentApprovalStatus';
import { getAcademicContext } from '@/services/noDueAutomationService';
import { calculateSemester } from '@/types/schema';

const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('');
  const [contextLoading, setContextLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadContext = async () => {
      if (!user || user.role !== 'student') {
        setContextLoading(false);
        return;
      }

      try {
        const context = await getAcademicContext();
        if (!isMounted) {
          return;
        }

        setAcademicYear(context.academicYear);
        const semesterNumber = calculateSemester(
          user.batchYear,
          context.academicYear,
          context.semesterType
        );
        setSemester(String(semesterNumber));
      } catch (error) {
        console.error('Failed to load academic context:', error);
      } finally {
        if (isMounted) {
          setContextLoading(false);
        }
      }
    };

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (!user || user.role !== 'student') {
    return null;
  }

  const resolvedAcademicYear = academicYear || new Date().getFullYear().toString();
  const resolvedSemester = semester || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Welcome Card */}
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Welcome, {user.name}!</CardTitle>
                <CardDescription>Student Dashboard</CardDescription>
              </div>
              <Badge variant="secondary" className="text-sm">
                <GraduationCap className="mr-1 h-4 w-4" />
                Student
              </Badge>
            </CardHeader>
          </Card>

          {/* Profile Information */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                    <p className="text-base font-semibold">{user.name}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-base font-semibold">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Department</p>
                    <p className="text-base font-semibold">{user.dept}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <GraduationCap className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Registration No.</p>
                    <p className="text-base font-semibold">{'regNo' in user ? user.regNo : 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Access your portal features</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center"
                onClick={() => navigate('/')}
              >
                <GraduationCap className="h-8 w-8 mb-2" />
                <span>Research Hub</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center"
                onClick={() => navigate('/')}
              >
                <Building2 className="h-8 w-8 mb-2" />
                <span>No Due Clearance</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center"
                onClick={() => navigate('/')}
              >
                <User className="h-8 w-8 mb-2" />
                <span>My Profile</span>
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold">No-Due Clearance Status</h3>
                <p className="text-sm text-muted-foreground">
                  {academicYear
                    ? `${academicYear} · Semester ${semester || 'All'}`
                    : 'Loading academic context...'}
                </p>
              </div>
            </div>
            {contextLoading ? (
              <Card className="shadow-lg">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Loading your no-due requests...
                </CardContent>
              </Card>
            ) : (
              <StudentApprovalStatus
                academicYear={resolvedAcademicYear}
                semester={resolvedSemester}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
