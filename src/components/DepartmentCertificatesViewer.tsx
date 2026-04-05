import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Award, Loader2 } from 'lucide-react';
import {
  getDepartmentCertificates,
  downloadDepartmentCertificate,
  DepartmentCertificate,
} from '@/services/departmentCertificateService';
import { useToast } from '@/hooks/use-toast';

export function DepartmentCertificatesViewer() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [certificates, setCertificates] = useState<DepartmentCertificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Log on component mount
  console.log('🔍 DepartmentCertificatesViewer mounted');
  console.log('Current user:', user);

  // Load certificates on component mount
  useEffect(() => {
    console.log('useEffect triggered, user:', user);
    loadCertificates();
  }, [user]);

  const loadCertificates = async () => {
    console.log('📂 loadCertificates called');
    console.log('User object:', user);
    
    // Check if user exists and is a teacher
    if (!user) {
      console.warn('❌ User is null or undefined');
      return;
    }
    
    console.log('User role:', user.role);
    
    if (user.role !== 'teacher') {
      console.warn('❌ User role is not teacher:', user.role);
      return;
    }

    setLoading(true);
    try {
      // Get departmentId from user object
      const deptId =
        (user as any)?.departmentId ||
        (user as any)?.department_id ||
        (user as any)?.dept ||
        'UNKNOWN';
      console.log('🏢 Department ID:', deptId);
      
      if (deptId === 'UNKNOWN') {
        console.warn('❌ No department ID found in user object');
        console.log('User object keys:', Object.keys(user));
        toast({
          title: 'Warning',
          description: 'Department ID not found. Unable to load certificates.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      console.log(`📡 Fetching certificates for department: ${deptId}`);
      const certs = await getDepartmentCertificates(deptId);
      console.log(`✅ Loaded ${certs.length} certificates:`, certs);
      setCertificates(certs);
    } catch (error) {
      console.error('❌ Error loading certificates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load department certificates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (certificate: DepartmentCertificate) => {
    setDownloading(certificate.filename);
    try {
      await downloadDepartmentCertificate(certificate.downloadUrl);
      toast({
        title: 'Success',
        description: `Downloaded ${certificate.certificateName}`,
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download certificate',
        variant: 'destructive',
      });
    } finally {
      setDownloading(null);
    }
  };

  if (!user || user.role !== 'teacher') {
    return null;
  }

  return (
    <Card className="shadow-lg border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Award className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-blue-900">Student Certificates</CardTitle>
              <CardDescription className="text-blue-700">
                All certificates uploaded by students in your department
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-blue-600 hover:bg-blue-700">{certificates.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-blue-600">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading certificates...</span>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No certificates uploaded by students yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-200 bg-blue-100">
                    <th className="px-4 py-2 text-left font-semibold text-blue-900">USN</th>
                    <th className="px-4 py-2 text-left font-semibold text-blue-900">Student Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-blue-900">Certificate Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-blue-900">Upload Date</th>
                    <th className="px-4 py-2 text-center font-semibold text-blue-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr
                      key={`${cert.usn}-${cert.filename}`}
                      className="border-b border-blue-100 hover:bg-white transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                        {cert.usn}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{cert.studentName}</td>
                      <td className="px-4 py-3 text-gray-700">{cert.certificateName}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(cert.uploadedAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleDownload(cert)}
                          disabled={downloading === cert.filename}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          {downloading === cert.filename ? 'Downloading...' : 'Download'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
