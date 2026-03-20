import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Clock, Download, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { NoDueRequestWithDetails, generateNoDueRequestId } from '@/types/schema';
import { getStudentNoDueRequests, resubmitNoDueRequest } from '@/services/noDueAutomationService';
import { openNoDueCertificate } from '@/services/certificateService';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface StudentApprovalStatusProps {
  academicYear: string;
  semester: string;
}

const APPROVED_STATUSES: Array<NoDueRequestWithDetails['status']> = ['approved', 'mentor_approved', 'completed'];
const REJECTED_STATUSES: Array<NoDueRequestWithDetails['status']> = ['rejected', 'mentor_rejected'];

export function StudentApprovalStatus({ academicYear, semester }: StudentApprovalStatusProps) {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState<NoDueRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [allComplete, setAllComplete] = useState(false);
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState<NoDueRequestWithDetails | null>(null);
  const [resubmitComment, setResubmitComment] = useState('');
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    if (userProfile) {
      loadRequests();
    }
  }, [userProfile, semester]);

  const loadRequests = async () => {
    if (!userProfile || userProfile.role !== 'student' || !('usn' in userProfile)) {
      console.log('[StudentApprovalStatus] Skipping load - missing student profile', { hasProfile: Boolean(userProfile) });
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const semesterNumber = parseInt(semester, 10);
      console.log('[StudentApprovalStatus] Fetching requests', {
        usn: userProfile.usn,
        semesterFilter: Number.isNaN(semesterNumber) ? 'all' : semesterNumber,
      });
      const data = await getStudentNoDueRequests(userProfile.usn);
      const filtered = Number.isNaN(semesterNumber)
        ? data
        : data.filter((request) => request.semesterNumber === semesterNumber);

      console.log('[StudentApprovalStatus] Requests loaded', {
        total: data.length,
        filtered: filtered.length,
        sampleStatuses: filtered.slice(0, 3).map((request) => ({
          referenceId: request.referenceId,
          status: request.status,
        })),
      });
      const sorted = [...filtered].sort((a, b) => a.referenceType.localeCompare(b.referenceType));
      setRequests(sorted);
      evaluateCompletion(sorted);
    } catch (error) {
      console.error('Error loading student requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load no-due status',
        variant: 'destructive',
      });
      setRequests([]);
      setAllComplete(false);
    } finally {
      setLoading(false);
    }
  };

  const evaluateCompletion = (current: NoDueRequestWithDetails[]) => {
    const nonMentor = current.filter((request) => request.referenceType !== 'mentor');
    if (nonMentor.length === 0) {
      setAllComplete(false);
      return;
    }

    const teacherClearance = nonMentor.every((request) => APPROVED_STATUSES.includes(request.status));
    const mentorRequest = current.find((request) => request.referenceType === 'mentor');
    const mentorClearance = mentorRequest ? APPROVED_STATUSES.includes(mentorRequest.status) : false;
    setAllComplete(teacherClearance && mentorClearance);
  };

  const stats = useMemo(() => {
    const approvedCount = requests.filter((request) => APPROVED_STATUSES.includes(request.status)).length;
    const rejectedCount = requests.filter((request) => REJECTED_STATUSES.includes(request.status)).length;
    const pendingCount = Math.max(requests.length - approvedCount - rejectedCount, 0);
    const progressPercentage = requests.length ? Math.round((approvedCount / requests.length) * 100) : 0;
    return { approvedCount, rejectedCount, pendingCount, progressPercentage };
  }, [requests]);

  const getStatusBadge = (status: NoDueRequestWithDetails['status']) => {
    if (APPROVED_STATUSES.includes(status)) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="mr-1 h-3 w-3" />Approved
        </Badge>
      );
    }

    if (status === 'resubmitted') {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          <Clock className="mr-1 h-3 w-3" />Resubmitted
        </Badge>
      );
    }

    if (REJECTED_STATUSES.includes(status)) {
      return (
        <Badge className="bg-red-100 text-red-800">
          <XCircle className="mr-1 h-3 w-3" />Rejected
        </Badge>
      );
    }

    if (status === 'pending_mentor_approval') {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          <Clock className="mr-1 h-3 w-3" />Mentor Pending
        </Badge>
      );
    }

    return (
      <Badge className="bg-yellow-100 text-yellow-800">
        <Clock className="mr-1 h-3 w-3" />Pending
      </Badge>
    );
  };

  const formatCategoryLabel = (request: NoDueRequestWithDetails) => {
    switch (request.referenceType) {
      case 'core_subject':
        return `Core • ${request.referenceId}`;
      case 'open_elective':
        return `Open Elective • ${request.referenceId}`;
      case 'common_clearance':
        return `Common • ${request.referenceId}`;
      case 'mentor':
        return 'Mentor Clearance';
      default:
        return request.referenceId;
    }
  };

  const formatDate = (timestamp?: any) => {
    if (!timestamp) {
      return '-';
    }
    try {
      return format(timestamp.toDate(), 'MMM dd, yyyy');
    } catch {
      return '-';
    }
  };

  const openResubmitDialog = (request: NoDueRequestWithDetails) => {
    setResubmitTarget(request);
    setResubmitComment('');
    setResubmitDialogOpen(true);
  };

  const handleResubmit = async () => {
    if (!resubmitTarget || !resubmitComment.trim()) {
      toast({
        title: 'Comments required',
        description: 'Please add a comment before resubmitting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setResubmitting(true);
      const requestId = generateNoDueRequestId(resubmitTarget.usn, resubmitTarget.referenceId);
      await resubmitNoDueRequest(requestId, resubmitComment.trim());
      toast({
        title: 'Resubmitted',
        description: 'Your request has been resubmitted to the teacher.',
      });
      setResubmitDialogOpen(false);
      setResubmitTarget(null);
      setResubmitComment('');
      await loadRequests();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resubmit the request.',
        variant: 'destructive',
      });
    } finally {
      setResubmitting(false);
    }
  };

  const handleDownloadCertificate = () => {
    if (!userProfile || userProfile.role !== 'student') {
      return;
    }

    if (!allComplete) {
      toast({
        title: 'Approvals pending',
        description: 'Complete all approvals (including mentor clearance) before downloading the certificate.',
        variant: 'destructive',
      });
      return;
    }

    const approvedRequests = requests.filter((request) => APPROVED_STATUSES.includes(request.status));
    if (approvedRequests.length === 0) {
      toast({
        title: 'No approved requests',
        description: 'Once approvals are complete you can generate the certificate.',
        variant: 'destructive',
      });
      return;
    }

    const certificateData = {
      studentName: userProfile.name,
      studentRegNo: userProfile.usn,
      studentDept: userProfile.departmentId,
      studentBranch: userProfile.departmentId,
      studentYear: userProfile.batchYear?.toString() || 'N/A',
      academicYear,
      semester,
      approvals: approvedRequests.map((request) => ({
        category: formatCategoryLabel(request),
        teacherName: request.teacherName,
        approvedAt: request.approvedAt ? request.approvedAt.toDate() : new Date(),
      })),
      generatedAt: new Date(),
    };

    openNoDueCertificate(certificateData);
    toast({
      title: 'Certificate generated',
      description: 'Your No-Due certificate is ready to print.',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Approval Requests</CardTitle>
          <CardDescription>
            You haven't submitted any approval requests for {academicYear} - Semester {semester}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Submit approval requests to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>No-Due Clearance Progress</CardTitle>
          <CardDescription>
            {academicYear} - Semester {semester}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {stats.approvedCount} of {requests.length} approvals completed
              </span>
              <span className="text-sm text-muted-foreground">{stats.progressPercentage}%</span>
            </div>
            <Progress value={stats.progressPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.approvedCount}</p>
              <p className="text-xs text-green-700">Approved</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</p>
              <p className="text-xs text-yellow-700">Pending</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{stats.rejectedCount}</p>
              <p className="text-xs text-red-700">Rejected</p>
            </div>
          </div>

          {allComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    All approvals completed! You can now download your No-Due certificate.
                  </span>
                </div>
                <Button onClick={handleDownloadCertificate} size="sm" className="bg-green-600 hover:bg-green-700">
                  <Download className="mr-2 h-4 w-4" />
                  Download Certificate
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Details */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={`${request.usn}_${request.referenceId}`} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{formatCategoryLabel(request)}</h4>
                        {getStatusBadge(request.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">Teacher:</span>{' '}
                          <span className="font-medium">{request.teacherName}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Requested:</span>{' '}
                          <span>{formatDate(request.requestedAt)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Updated:</span>{' '}
                          <span>
                            {request.status === 'resubmitted'
                              ? formatDate(request.resubmittedAt)
                              : request.approvedAt
                              ? formatDate(request.approvedAt)
                              : '-'}
                          </span>
                        </div>
                      </div>

                      {REJECTED_STATUSES.includes(request.status) && request.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Rejection Reason:
                          </p>
                          <p className="text-sm text-red-700 mt-1">{request.rejectionReason}</p>
                        </div>
                      )}

                      {request.status === 'resubmitted' && request.studentResubmissionComment && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm font-medium text-blue-800 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Resubmission Comment:
                          </p>
                          <p className="text-sm text-blue-700 mt-1">{request.studentResubmissionComment}</p>
                        </div>
                      )}

                      {REJECTED_STATUSES.includes(request.status) && (
                        <div className="pt-2">
                          <Button size="sm" variant="secondary" onClick={() => openResubmitDialog(request)}>
                            Resubmit
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    
    <Dialog open={resubmitDialogOpen} onOpenChange={setResubmitDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resubmit Request</DialogTitle>
          <DialogDescription>Explain what you have corrected for this no-due request.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="resubmit-comment">Comments *</Label>
          <Textarea
            id="resubmit-comment"
            value={resubmitComment}
            onChange={(e) => setResubmitComment(e.target.value)}
            placeholder="Add your resubmission note"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setResubmitDialogOpen(false)} disabled={resubmitting}>
            Cancel
          </Button>
          <Button onClick={handleResubmit} disabled={resubmitting}>
            {resubmitting ? 'Resubmitting...' : 'Resubmit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
