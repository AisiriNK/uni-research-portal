import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Mail, GraduationCap, Building2, Download, FileText, CheckCircle2, AlertCircle, Upload, Trash2, Award } from 'lucide-react';
import { StudentApprovalStatus } from '@/components/StudentApprovalStatus';
import { getAcademicContext } from '@/services/noDueAutomationService';
import { getStudentHallTicket } from '@/services/hallTicketService';
import { uploadCertificate, listCertificates, downloadCertificate, deleteCertificate } from '@/services/certificateService';
import { calculateSemester } from '@/types/schema';
import { useToast } from '@/hooks/use-toast';

const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('');
  const [contextLoading, setContextLoading] = useState(true);
  const [hallTicket, setHallTicket] = useState<{
    downloadUrl: string;
    semesterNumber: number;
    generatedAt?: Date;
  } | null>(null);
  
  // Certificate state
  const [certificates, setCertificates] = useState<Array<{
    filename: string;
    certificateName: string;
    fileSize: number;
    uploadedAt: string;
    fileType: string;
    downloadUrl: string;
  }>>([]);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [certificateName, setCertificateName] = useState('');
  const [selectedCertificateFile, setSelectedCertificateFile] = useState<File | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    const loadHallTicket = async () => {
      if (!user || user.role !== 'student' || !('usn' in user)) {
        return;
      }

      try {
        const ticket = await getStudentHallTicket(user.usn);
        if (!isMounted) {
          return;
        }
        setHallTicket(ticket);
      } catch (error) {
        console.error('Failed to load hall ticket:', error);
      }
    };

    loadHallTicket();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadCertificates = async () => {
      if (!user || user.role !== 'student' || !('usn' in user)) {
        return;
      }

      try {
        const certs = await listCertificates(user.usn);
        if (isMounted) {
          setCertificates(certs);
        }
      } catch (error) {
        console.error('Failed to load certificates:', error);
      }
    };

    loadCertificates();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleCertificateUpload = async () => {
    if (!user || !('usn' in user) || !selectedCertificateFile || !certificateName) {
      toast({
        title: 'Missing information',
        description: 'Please provide certificate name and select a file',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCertificateLoading(true);
      const result = await uploadCertificate(user.usn, certificateName, selectedCertificateFile);
      
      toast({
        title: 'Success',
        description: `Certificate "${certificateName}" uploaded successfully`,
      });

      // Reset form
      setCertificateName('');
      setSelectedCertificateFile(null);

      // Reload certificates
      const certs = await listCertificates(user.usn);
      setCertificates(certs);
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error?.message || 'Failed to upload certificate',
        variant: 'destructive',
      });
    } finally {
      setCertificateLoading(false);
    }
  };

  const handleDownloadHallTicket = async () => {
    if (!hallTicket || !user || !('usn' in user)) return;

    try {
      let downloadUrl = hallTicket.downloadUrl;
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      
      // Convert relative URLs to absolute
      if (!downloadUrl.startsWith('http')) {
        downloadUrl = `${BACKEND_URL}${downloadUrl}`;
      }
      
      // Fetch and download the file
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HallTicket_${user.usn}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: 'Hall ticket downloaded successfully',
      });
    } catch (error: any) {
      console.error('Error downloading hall ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to download hall ticket',
        variant: 'destructive',
      });
    }
  };

  const handleCertificateDelete = async (filename: string, certName: string) => {
    if (!user || !('usn' in user)) return;

    try {
      setCertificateLoading(true);
      await deleteCertificate(user.usn, filename);
      
      toast({
        title: 'Deleted',
        description: `Certificate "${certName}" removed`,
      });

      // Reload certificates
      const certs = await listCertificates(user.usn);
      setCertificates(certs);
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error?.message || 'Failed to delete certificate',
        variant: 'destructive',
      });
    } finally {
      setCertificateLoading(false);
    }
  };

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
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                onClick={() => {
                  const element = document.getElementById('certificates-section');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Award className="h-8 w-8 mb-2" />
                <span>Certificates</span>
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
                <h3 className="text-xl font-semibold">Academic Portal</h3>
                <p className="text-sm text-muted-foreground">
                  {academicYear
                    ? `${academicYear} · Semester ${semester || 'All'}`
                    : 'Loading academic context...'}
                </p>
              </div>
            </div>

            {/* Hall Ticket Section */}
            {hallTicket?.downloadUrl ? (
              <Card className="shadow-lg border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-green-900">Hall Ticket Ready</CardTitle>
                        <CardDescription className="text-green-700">
                          Your examination hall ticket has been generated
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-green-600 hover:bg-green-700">Available</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Semester</p>
                      <p className="text-lg font-semibold text-green-900">
                        Semester {hallTicket.semesterNumber}
                      </p>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Generated Date</p>
                      <p className="text-lg font-semibold text-green-900">
                        {hallTicket.generatedAt
                          ? hallTicket.generatedAt.toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Recently'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      📋 Important Information
                    </p>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">•</span>
                        <span>Keep this hall ticket secure and bring it during your examination</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">•</span>
                        <span>Your roll number is required for seating arrangements</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">•</span>
                        <span>Print this ticket clearly for exam hall verification</span>
                      </li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleDownloadHallTicket}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download Hall Ticket (PDF)
                  </Button>

                  <Button
                    onClick={() => {
                      // Copy download URL to clipboard
                      navigator.clipboard.writeText(hallTicket.downloadUrl);
                      alert('Download link copied to clipboard!');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Copy Download Link
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <AlertCircle className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <CardTitle className="text-amber-900">Hall Ticket Pending</CardTitle>
                        <CardDescription className="text-amber-700">
                          Waiting for generation
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-white rounded-lg border border-amber-200">
                    <p className="text-sm text-gray-700">
                      Your hall ticket will be available once:
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-gray-700">
                      <li className="flex items-center gap-2">
                        <span className="text-amber-600">✓</span>
                        <span>Mentor approval is received</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-amber-600">✓</span>
                        <span>No-due clearance is completed</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-amber-600">✓</span>
                        <span>Admin generates your hall ticket</span>
                      </li>
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Check back here once all clearances are completed
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Certificate Upload Section */}
            <Card className="shadow-lg border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50" id="certificates-section">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Award className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-blue-900">My Certificates</CardTitle>
                      <CardDescription className="text-blue-700">
                        Upload and manage your certificates (stored securely in backend)
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-blue-600 hover:bg-blue-700">{certificates.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Form */}
                <div className="p-4 bg-white rounded-lg border border-blue-200 space-y-3">
                  <h3 className="font-semibold text-blue-900">Upload New Certificate</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Certificate Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Sports Certificate, Cultural Achievement"
                        value={certificateName}
                        onChange={(e) => setCertificateName(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Select File</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => setSelectedCertificateFile(e.currentTarget.files?.[0] || null)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)
                      </p>
                    </div>
                    <Button
                      onClick={handleCertificateUpload}
                      disabled={certificateLoading || !certificateName || !selectedCertificateFile}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {certificateLoading ? 'Uploading...' : 'Upload Certificate'}
                    </Button>
                  </div>
                </div>

                {/* Certificates List */}
                {certificates.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900">Your Certificates ({certificates.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {certificates.map((cert) => (
                        <div
                          key={cert.filename}
                          className="p-3 bg-white rounded-lg border border-blue-200 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate text-sm">
                                {cert.certificateName}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {cert.filename}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(cert.uploadedAt).toLocaleDateString('en-IN')}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                              onClick={() => downloadCertificate(user.usn as string, cert.filename)}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1 text-xs"
                              onClick={() => handleCertificateDelete(cert.filename, cert.certificateName)}
                              disabled={certificateLoading}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Award className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No certificates uploaded yet</p>
                    <p className="text-xs text-gray-400 mt-1">Upload your first certificate to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>

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
