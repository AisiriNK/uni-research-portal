import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Trash2, Award } from 'lucide-react';
import { uploadCertificate, listCertificates, downloadCertificate, deleteCertificate } from '@/services/certificateService';
import { DepartmentCertificatesViewer } from '@/components/DepartmentCertificatesViewer';
import { useToast } from '@/hooks/use-toast';

export function CertificatesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  
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

  // Load certificates on mount
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
    if (!certificateName || !selectedCertificateFile) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a certificate name and select a file',
        variant: 'destructive',
      });
      return;
    }

    if (!user || user.role !== 'student' || !('usn' in user)) {
      return;
    }

    try {
      setCertificateLoading(true);
      await uploadCertificate(user.usn, certificateName, selectedCertificateFile);
      
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

  const handleCertificateDelete = async (filename: string, certName: string) => {
    if (!user || user.role !== 'student' || !('usn' in user)) {
      return;
    }

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

  if (!user) {
    return null;
  }

  if (user.role === 'teacher') {
    return <DepartmentCertificatesViewer />;
  }

  if (user.role !== 'student') {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
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
    </div>
  );
}
