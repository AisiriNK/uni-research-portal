import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { getAllTeachers, createSubmission } from '@/services/noDueService';
import { CreateSubmissionData } from '@/types/nodue';
import { toast } from '@/hooks/use-toast';

const CATEGORIES = [
  'Library',
  'Hostel',
  'Department',
  'Accounts',
  'Examination Cell',
  'Training & Placement',
  'Other'
];

export function StudentSubmissionForm() {
  const { user, userProfile } = useAuth();
  const [teachers, setTeachers] = useState<Array<{id: string, name: string, email: string, dept: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    teacherId: '',
    teacherName: '',
    teacherEmail: '',
    title: '',
    description: '',
    category: '',
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const teachersList = await getAllTeachers();
      setTeachers(teachersList);
    } catch (err) {
      console.error('Error loading teachers:', err);
      toast({
        title: 'Error',
        description: 'Failed to load teachers list',
        variant: 'destructive',
      });
    } finally {
      setLoadingTeachers(false);
    }
  };

  const handleTeacherChange = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher) {
      setFormData(prev => ({
        ...prev,
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherEmail: teacher.email,
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        setSelectedFile(null);
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const validateForm = (): boolean => {
    if (!formData.teacherId) {
      setError('Please select a teacher');
      return false;
    }
    if (!formData.title.trim()) {
      setError('Please enter a title');
      return false;
    }
    if (!formData.category) {
      setError('Please select a category');
      return false;
    }
    if (!selectedFile) {
      setError('Please upload a PDF file');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validateForm()) return;
    if (!user || !userProfile) {
      setError('User information not available');
      return;
    }

    setLoading(true);

    try {
      const studentData = {
        id: user.uid,
        name: userProfile.name,
        email: userProfile.email,
        dept: userProfile.dept || '',
        regNo: 'regNo' in userProfile ? userProfile.regNo : '',
      };

      const submissionData: CreateSubmissionData = {
        teacherId: formData.teacherId,
        teacherName: formData.teacherName,
        teacherEmail: formData.teacherEmail,
        pdfFile: selectedFile!,
        metadata: {
          title: formData.title,
          description: formData.description,
          category: formData.category,
        },
      };

      await createSubmission(studentData, submissionData);
      
      setSuccess(true);
      toast({
        title: 'Success!',
        description: 'Your submission has been sent to the teacher.',
      });

      // Reset form
      setFormData({
        teacherId: '',
        teacherName: '',
        teacherEmail: '',
        title: '',
        description: '',
        category: '',
      });
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting your document.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingTeachers) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="mr-2 h-5 w-5" />
          Submit No-Due Document
        </CardTitle>
        <CardDescription>
          Upload your document and send it to a teacher for approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Document submitted successfully! The teacher will review your submission.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="teacher">Select Teacher *</Label>
            <Select value={formData.teacherId} onValueChange={handleTeacherChange} disabled={loading}>
              <SelectTrigger id="teacher">
                <SelectValue placeholder="Choose a teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name} - {teacher.dept || 'No Department'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))} disabled={loading}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              type="text"
              placeholder="e.g., Library Clearance Form"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add any additional comments or details..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf-upload">Upload PDF *</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={loading}
                className="hidden"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                {selectedFile ? (
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm font-medium">Click to upload PDF</p>
                    <p className="text-xs text-muted-foreground">Maximum file size: 10MB</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Submit Document
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
