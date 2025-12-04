import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { getAllTeachers } from '@/services/noDueService';
import { createApprovalRequest } from '@/services/approvalService';
import { ApprovalCategory, APPROVAL_CATEGORIES, CreateApprovalRequestData } from '@/types/approval';
import { toast } from '@/hooks/use-toast';

interface ApprovalRequestFormData extends CreateApprovalRequestData {
  tempId: string;
}

interface StudentApprovalRequestFormProps {
  academicYear: string;
  semester: string;
  onSuccess?: () => void;
}

export function StudentApprovalRequestForm({ 
  academicYear: initialAcademicYear, 
  semester: initialSemester,
  onSuccess 
}: StudentApprovalRequestFormProps) {
  const { userProfile } = useAuth();
  const [teachers, setTeachers] = useState<Array<{id: string, name: string, email: string, dept: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  
  const [academicYear, setAcademicYear] = useState(initialAcademicYear);
  const [semester, setSemester] = useState(initialSemester);
  
  const [requests, setRequests] = useState<ApprovalRequestFormData[]>([
    {
      tempId: '1',
      teacherId: '',
      teacherName: '',
      teacherEmail: '',
      teacherDept: '',
      category: 'subject_teacher',
      categoryLabel: '',
      comments: '',
      academicYear: '2024-2025',
      semester: '8',
    },
  ]);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const teachersList = await getAllTeachers();
      setTeachers(teachersList);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load teachers list',
        variant: 'destructive',
      });
    } finally {
      setLoadingTeachers(false);
    }
  };

  const addRequest = () => {
    setRequests([
      ...requests,
      {
        tempId: Date.now().toString(),
        teacherId: '',
        teacherName: '',
        teacherEmail: '',
        teacherDept: '',
        category: 'subject_teacher',
        categoryLabel: '',
        comments: '',
        academicYear,
        semester,
      },
    ]);
  };

  const removeRequest = (tempId: string) => {
    setRequests(requests.filter(r => r.tempId !== tempId));
  };

  const updateRequest = (tempId: string, field: string, value: any) => {
    setRequests(requests.map(r => {
      if (r.tempId === tempId) {
        if (field === 'teacherId') {
          const teacher = teachers.find(t => t.id === value);
          if (teacher) {
            return {
              ...r,
              teacherId: value,
              teacherName: teacher.name,
              teacherEmail: teacher.email,
              teacherDept: teacher.dept,
            };
          }
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleSubmit = async () => {
    if (!userProfile || userProfile.role !== 'student') {
      toast({
        title: 'Error',
        description: 'Only students can request approvals',
        variant: 'destructive',
      });
      return;
    }

    // Validation
    const invalidRequests = requests.filter(r => 
      !r.teacherId || !r.categoryLabel
    );

    if (invalidRequests.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in teacher and category label for all requests',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const studentData = {
        id: userProfile.uid,
        name: userProfile.name,
        email: userProfile.email,
        regNo: 'regNo' in userProfile ? userProfile.regNo : '',
        dept: userProfile.dept,
        branch: ('branch' in userProfile ? userProfile.branch : userProfile.dept) || userProfile.dept,
        year: ('year' in userProfile ? userProfile.year : null) || `Year ${Math.ceil(parseInt(semester) / 2)}`,
      };

      // Create all approval requests
      const promises = requests.map(request =>
        createApprovalRequest(studentData, {
          ...request,
          academicYear,
          semester,
        })
      );

      await Promise.all(promises);

      toast({
        title: 'Success',
        description: `${requests.length} approval request(s) sent successfully`,
      });

      // Reset form
      setRequests([{
        tempId: '1',
        teacherId: '',
        teacherName: '',
        teacherEmail: '',
        teacherDept: '',
        category: 'subject_teacher',
        categoryLabel: '',
        comments: '',
        academicYear,
        semester,
      }]);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error submitting approval requests:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit approval requests',
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
        <CardTitle>Request No-Due Approvals</CardTitle>
        <CardDescription>
          Submit approval requests to teachers and departments for no-due clearance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Academic Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="academicYear">Academic Year</Label>
            <Input
              id="academicYear"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2024-2025"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="semester">Semester</Label>
            <Input
              id="semester"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="8"
            />
          </div>
        </div>

        {/* Approval Requests */}
        <div className="space-y-4">
          {requests.map((request, index) => (
            <Card key={request.tempId} className="border-2">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Request #{index + 1}</h3>
                  {requests.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRequest(request.tempId)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`teacher-${request.tempId}`}>Teacher/Department *</Label>
                    <Select
                      value={request.teacherId}
                      onValueChange={(value) => updateRequest(request.tempId, 'teacherId', value)}
                    >
                      <SelectTrigger id={`teacher-${request.tempId}`}>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name} - {teacher.dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`category-${request.tempId}`}>Category *</Label>
                    <Select
                      value={request.category}
                      onValueChange={(value) => updateRequest(request.tempId, 'category', value as ApprovalCategory)}
                    >
                      <SelectTrigger id={`category-${request.tempId}`}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(APPROVAL_CATEGORIES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor={`label-${request.tempId}`}>Category Label (e.g., Subject Name/Code) *</Label>
                    <Input
                      id={`label-${request.tempId}`}
                      placeholder="e.g., Data Structures - CSE301"
                      value={request.categoryLabel}
                      onChange={(e) => updateRequest(request.tempId, 'categoryLabel', e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor={`comments-${request.tempId}`}>Comments (Optional)</Label>
                    <Textarea
                      id={`comments-${request.tempId}`}
                      placeholder="Add any additional information..."
                      value={request.comments}
                      onChange={(e) => updateRequest(request.tempId, 'comments', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add More Button */}
        <Button
          variant="outline"
          onClick={addRequest}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Another Approval Request
        </Button>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            `Submit ${requests.length} Request(s)`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
