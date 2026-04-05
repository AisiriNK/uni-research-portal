import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  getTeacherNoDueRequests,
  approveNoDueRequest,
  rejectNoDueRequest,
  getMentorStudentSummaries,
  getStudentNoDueRequests,
  getAcademicContext,
} from '@/services/noDueAutomationService';
import type { MentorStudentSummary } from '@/services/noDueAutomationService';
import { NoDueRequestWithDetails, generateNoDueRequestId } from '@/types/schema';
import { getStudentFeedbackStatus } from '@/services/courseFeedbackService';
import { getFeePaidStatus } from '@/services/feePaidStatusService';
import { format } from 'date-fns';

export function TeacherApprovalTable() {
  const { userProfile } = useAuth();
  const [approvals, setApprovals] = useState<NoDueRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<NoDueRequestWithDetails | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [mentorSummaries, setMentorSummaries] = useState<MentorStudentSummary[]>([]);
  const [mentorLoading, setMentorLoading] = useState(true);
  const [mentorError, setMentorError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teacher' | 'mentor'>('teacher');
  const [mentorRequestDetails, setMentorRequestDetails] = useState<Record<string, NoDueRequestWithDetails[] | null>>({});
  const [academicYear, setAcademicYear] = useState<string | null>(null);
  const [feedbackStatusByUsn, setFeedbackStatusByUsn] = useState<Record<string, boolean | null>>({});
  const [feedbackStatusLoading, setFeedbackStatusLoading] = useState(false);
  const [feePaidStatusByUsn, setFeePaidStatusByUsn] = useState<Record<string, boolean | null>>({});
  const [feePaidStatusLoading, setFeePaidStatusLoading] = useState(false);

  useEffect(() => {
    if (userProfile) {
      loadApprovals();
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile) {
      loadMentorSummaries();
    }
  }, [userProfile]);

  useEffect(() => {
    let cancelled = false;

    const loadAcademicYear = async () => {
      try {
        const context = await getAcademicContext();
        if (!cancelled) {
          setAcademicYear(context.academicYear);
        }
      } catch (error) {
        console.error('Failed to load academic context for feedback status', error);
      }
    };

    loadAcademicYear();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadApprovals = async () => {
    if (!userProfile) {
      return;
    }

    if (userProfile.role !== 'teacher') {
      toast({
        title: 'Restricted',
        description: 'Only teacher accounts can view pending no-due requests.',
        variant: 'destructive',
      });
      return;
    }

    const teacherIdentifier = userProfile.employeeId || userProfile.empId;

    if (!teacherIdentifier) {
      toast({
        title: 'Profile missing employee ID',
        description: 'Update the teacher profile with an employee ID to view requests.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const data = await getTeacherNoDueRequests(teacherIdentifier);
      setApprovals(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load no-due requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMentorSummaries = async () => {
    if (!userProfile) {
      return;
    }

    if (userProfile.role !== 'teacher') {
      setMentorSummaries([]);
      setMentorLoading(false);
      return;
    }

    const teacherIdentifier = userProfile.employeeId || userProfile.empId;

    if (!teacherIdentifier) {
      setMentorError('Profile missing employee ID. Update the teacher record to review mentor requests.');
      setMentorSummaries([]);
      setMentorLoading(false);
      return;
    }

    try {
      setMentorLoading(true);
      setMentorError(null);
      const data = await getMentorStudentSummaries(teacherIdentifier);
      setMentorSummaries(data);
    } catch (error) {
      console.error('Error loading mentor requests:', error);
      const isPermissionDenied =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'permission-denied';
      if (isPermissionDenied) {
        setMentorSummaries([]);
        setMentorError(null);
        return;
      }
      setMentorError('Failed to load mentor requests. Please try again.');
    } finally {
      setMentorLoading(false);
    }
  };

  const handleApprove = async (approval: NoDueRequestWithDetails) => {
    try {
      setProcessing(true);
      const requestId = generateNoDueRequestId(approval.usn, approval.referenceId);
      await approveNoDueRequest(requestId);

      toast({
        title: 'Approved',
        description: `Cleared ${approval.studentName}'s ${formatCategoryLabel(approval)}`,
      });

      await loadApprovals();
      await loadMentorSummaries();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectClick = (approval: NoDueRequestWithDetails) => {
    setSelectedApproval(approval);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedApproval || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for rejection',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessing(true);
      const requestId = generateNoDueRequestId(selectedApproval.usn, selectedApproval.referenceId);
      await rejectNoDueRequest(requestId, rejectionReason.trim());

      toast({
        title: 'Rejected',
        description: `Rejected ${selectedApproval.studentName}'s ${formatCategoryLabel(selectedApproval)}`,
      });

      setRejectDialogOpen(false);
      await loadApprovals();
      await loadMentorSummaries();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: NoDueRequestWithDetails['status']) => {
    switch (status) {
      case 'approved':
      case 'mentor_approved':
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />Approved
          </Badge>
        );
      case 'pending_mentor_approval':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Clock className="mr-1 h-3 w-3" />Mentor Pending
          </Badge>
        );
      case 'resubmitted':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Clock className="mr-1 h-3 w-3" />Resubmitted
          </Badge>
        );
      case 'rejected':
      case 'mentor_rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="mr-1 h-3 w-3" />Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="mr-1 h-3 w-3" />Pending
          </Badge>
        );
    }
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

  const teacherApprovals = approvals.filter((approval) => approval.referenceType !== 'mentor');
  const mentorApprovals = approvals.filter((approval) => approval.referenceType === 'mentor');
  const pendingApprovals = teacherApprovals.filter((approval) => ['pending', 'resubmitted'].includes(approval.status));
  const processedApprovals = teacherApprovals.filter((approval) => !['pending', 'resubmitted'].includes(approval.status));
  const mentorPendingApprovals = mentorApprovals.filter((approval) =>
    ['pending', 'pending_mentor_approval', 'resubmitted'].includes(approval.status)
  );
  const mentorProcessedApprovals = mentorApprovals.filter((approval) =>
    !['pending', 'pending_mentor_approval', 'resubmitted'].includes(approval.status)
  );
  const approvedCount = teacherApprovals.filter((approval) =>
    ['approved', 'mentor_approved', 'completed'].includes(approval.status)
  ).length;
  const rejectedCount = teacherApprovals.filter((approval) =>
    ['rejected', 'mentor_rejected'].includes(approval.status)
  ).length;
  const mentorSummaryByUsn = useMemo(
    () => new Map(mentorSummaries.map((summary) => [summary.student.usn, summary])),
    [mentorSummaries]
  );

  useEffect(() => {
    if (!academicYear) {
      return;
    }

    const targetMap = new Map<string, { departmentId: string; semesterNumber: number }>();

    approvals.forEach((approval) => {
      if (approval.departmentId && approval.semesterNumber) {
        targetMap.set(approval.usn, {
          departmentId: approval.departmentId,
          semesterNumber: approval.semesterNumber,
        });
      }
    });

    mentorSummaries.forEach((summary) => {
      const semesterNumber = summary.student.semesterNumber ?? summary.requests[0]?.semesterNumber;
      if (summary.student.departmentId && semesterNumber) {
        targetMap.set(summary.student.usn, {
          departmentId: summary.student.departmentId,
          semesterNumber,
        });
      }
    });

    const pendingUsns = Array.from(targetMap.entries()).filter(
      ([usn]) => feedbackStatusByUsn[usn] === undefined
    );

    if (pendingUsns.length === 0) {
      return;
    }

    let cancelled = false;
    setFeedbackStatusLoading(true);

    const loadFeedbackStatuses = async () => {
      const results = await Promise.all(
        pendingUsns.map(async ([usn, info]) => {
          try {
            const status = await getStudentFeedbackStatus(
              usn,
              info.departmentId,
              info.semesterNumber,
              academicYear
            );
            return { usn, completed: status?.allFeedbackCompleted ?? null };
          } catch (error) {
            console.error('Failed to load feedback status', { usn, error });
            return { usn, completed: null };
          }
        })
      );

      if (cancelled) {
        return;
      }

      setFeedbackStatusByUsn((prev) => {
        const next = { ...prev };
        results.forEach(({ usn, completed }) => {
          next[usn] = completed;
        });
        return next;
      });
      setFeedbackStatusLoading(false);
    };

    loadFeedbackStatuses();

    return () => {
      cancelled = true;
    };
  }, [academicYear, approvals, mentorSummaries, feedbackStatusByUsn]);

  const renderFeedbackBadge = (usn: string) => {
    if (!academicYear) {
      return (
        <Badge className="mt-1 bg-slate-100 text-slate-700">Feedback unavailable</Badge>
      );
    }

    if (feedbackStatusByUsn[usn] === true) {
      return (
        <Badge className="mt-1 bg-emerald-100 text-emerald-800">Feedback completed</Badge>
      );
    }

    if (feedbackStatusByUsn[usn] === false) {
      return (
        <Badge className="mt-1 bg-amber-100 text-amber-800">Feedback pending</Badge>
      );
    }

    if (feedbackStatusByUsn[usn] === null) {
      return (
        <Badge className="mt-1 bg-gray-100 text-gray-700">Feedback not uploaded</Badge>
      );
    }

    if (feedbackStatusLoading) {
      return (
        <Badge className="mt-1 bg-slate-100 text-slate-700">Checking feedback…</Badge>
      );
    }

    return (
      <Badge className="mt-1 bg-slate-100 text-slate-700">Feedback unknown</Badge>
    );
  };

  const renderFeePaidBadge = (usn: string) => {
    if (feePaidStatusByUsn[usn] === true) {
      return (
        <Badge className="mt-1 bg-green-100 text-green-800">💳 Fee Paid</Badge>
      );
    }

    if (feePaidStatusByUsn[usn] === false) {
      return (
        <Badge className="mt-1 bg-red-100 text-red-800">⚠️ Fee Not Paid</Badge>
      );
    }

    if (feePaidStatusByUsn[usn] === null) {
      return (
        <Badge className="mt-1 bg-gray-100 text-gray-700">No fee record</Badge>
      );
    }

    if (feePaidStatusLoading) {
      return (
        <Badge className="mt-1 bg-slate-100 text-slate-700">Checking fee…</Badge>
      );
    }

    return (
      <Badge className="mt-1 bg-slate-100 text-slate-700">Fee unknown</Badge>
    );
  };

  useEffect(() => {
    if (!userProfile || userProfile.role !== 'teacher') {
      return;
    }

    const mentorUsns = Array.from(new Set(mentorApprovals.map((approval) => approval.usn)));
    if (mentorUsns.length === 0) {
      return;
    }

    const missingUsns = mentorUsns.filter(
      (usn) => !mentorSummaryByUsn.has(usn) && !(usn in mentorRequestDetails)
    );

    if (missingUsns.length === 0) {
      return;
    }

    let cancelled = false;

    const loadMissingSummaries = async () => {
      const results = await Promise.all(
        missingUsns.map(async (usn) => {
          try {
            const requests = await getStudentNoDueRequests(usn);
            return { usn, requests };
          } catch (error) {
            console.error('Failed to load student no-due requests', { usn, error });
            return { usn, requests: null };
          }
        })
      );

      if (cancelled) {
        return;
      }

      setMentorRequestDetails((prev) => {
        const next = { ...prev };
        results.forEach(({ usn, requests }) => {
          next[usn] = requests;
        });
        return next;
      });
    };

    loadMissingSummaries();

    return () => {
      cancelled = true;
    };
  }, [mentorApprovals, mentorSummaries, mentorRequestDetails, userProfile]);

  // Load fee paid status for mentor requests
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'teacher') {
      return;
    }

    const mentorSummaryUsns = mentorSummaries.map((s) => s.student.usn);
    const allMentorUsns = Array.from(new Set(mentorSummaryUsns));

    if (allMentorUsns.length === 0) {
      return;
    }

    let cancelled = false;
    setFeePaidStatusLoading(true);

    const loadFeeStatuses = async () => {
      const results = await Promise.all(
        allMentorUsns.map(async (usn) => {
          try {
            const mentorSummary = mentorSummaryByUsn.get(usn);
            const deptId = mentorSummary?.student.departmentId;
            
            if (!deptId) {
              return { usn, feePaid: null };
            }

            const status = await getFeePaidStatus(usn, deptId);
            return { usn, feePaid: status.feePaid };
          } catch (error) {
            console.error('Failed to load fee paid status', { usn, error });
            return { usn, feePaid: null };
          }
        })
      );

      if (cancelled) {
        return;
      }

      setFeePaidStatusByUsn((prev) => {
        const next = { ...prev };
        results.forEach(({ usn, feePaid }) => {
          next[usn] = feePaid;
        });
        return next;
      });
      setFeePaidStatusLoading(false);
    };

    loadFeeStatuses();

    return () => {
      cancelled = true;
    };
  }, [mentorSummaries, mentorSummaryByUsn, userProfile]);

  const teacherContent = loading ? (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </CardContent>
    </Card>
  ) : (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{pendingApprovals.length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approval Requests ({pendingApprovals.length})</CardTitle>
          <CardDescription>Review and approve/reject no-due clearance requests</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingApprovals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending requests</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>USN</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.map((approval) => {
                  const rowKey = generateNoDueRequestId(approval.usn, approval.referenceId);
                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="font-medium">
                        {approval.studentName}
                        <div className="text-xs text-muted-foreground">
                          {approval.departmentId} • Sem {approval.semesterNumber}
                        </div>
                        {approval.status === 'resubmitted' && (
                          <div className="mt-2 space-y-1">
                            <Badge className="bg-blue-100 text-blue-800">Resubmitted</Badge>
                            {approval.studentResubmissionComment && (
                              <p className="text-xs text-muted-foreground">
                                {approval.studentResubmissionComment}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{approval.usn}</div>
                        {renderFeedbackBadge(approval.usn)}
                        {renderFeePaidBadge(approval.usn)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatCategoryLabel(approval)}</Badge>
                      </TableCell>
                      <TableCell>{approval.section || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {format(approval.requestedAt.toDate(), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(approval)}
                            disabled={processing}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectClick(approval)}
                            disabled={processing}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processed Requests ({processedApprovals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {processedApprovals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No processed requests</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>USN</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedApprovals.map((approval) => {
                  const rowKey = generateNoDueRequestId(approval.usn, approval.referenceId);
                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="font-medium">{approval.studentName}</TableCell>
                      <TableCell>
                        <div className="font-medium">{approval.usn}</div>
                        {renderFeedbackBadge(approval.usn)}
                        {renderFeePaidBadge(approval.usn)}
                      </TableCell>
                      <TableCell>{formatCategoryLabel(approval)}</TableCell>
                      <TableCell>{getStatusBadge(approval.status)}</TableCell>
                      <TableCell className="text-xs">
                        {approval.approvedAt ? format(approval.approvedAt.toDate(), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {approval.rejectionReason || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const mentorContent = (() => {
    if (!userProfile || userProfile.role !== 'teacher') {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Mentor review is only available to teacher accounts.
          </CardContent>
        </Card>
      );
    }

    if (mentorLoading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      );
    }

    if (mentorError) {
      return (
        <Card>
          <CardContent className="flex flex-col gap-3 py-6 text-center">
            <p className="text-sm text-red-600">{mentorError}</p>
            <Button variant="outline" size="sm" onClick={loadMentorSummaries}>
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (mentorSummaries.length === 0 && mentorApprovals.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No students mapped to you as mentor or no requests have been generated yet.
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {mentorApprovals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Mentor Clearance Requests ({mentorApprovals.length})</CardTitle>
              <CardDescription>Review mentor clearance items assigned to you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
                  Pending ({mentorPendingApprovals.length})
                </h4>
                {mentorPendingApprovals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No pending mentor requests.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>USN</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>All Requests</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mentorPendingApprovals.map((approval) => {
                        const rowKey = generateNoDueRequestId(approval.usn, approval.referenceId);
                        const canAct = ['pending_mentor_approval', 'resubmitted'].includes(approval.status) && !processing;
                        const summary = mentorSummaryByUsn.get(approval.usn);
                        const summaryRequests = summary?.requests ?? mentorRequestDetails[approval.usn] ?? undefined;
                        const totalRequests = summaryRequests?.length ?? 0;
                        const approvedRequests = summaryRequests?.filter((request) =>
                          ['approved', 'mentor_approved', 'completed'].includes(request.status)
                        ).length ?? 0;
                        const pendingRequests = summaryRequests?.filter((request) =>
                          !['approved', 'mentor_approved', 'completed', 'rejected', 'mentor_rejected'].includes(request.status)
                        ).length ?? 0;
                        const rejectedRequests = summaryRequests?.filter((request) =>
                          ['rejected', 'mentor_rejected'].includes(request.status)
                        ).length ?? 0;
                        return (
                          <TableRow key={rowKey}>
                            <TableCell className="font-medium">
                              {approval.studentName}
                              {approval.status === 'resubmitted' && (
                                <div className="mt-2 space-y-1">
                                  <Badge className="bg-blue-100 text-blue-800">Resubmitted</Badge>
                                  {approval.studentResubmissionComment && (
                                    <p className="text-xs text-muted-foreground">
                                      {approval.studentResubmissionComment}
                                    </p>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{approval.usn}</div>
                              {renderFeedbackBadge(approval.usn)}
                              {renderFeePaidBadge(approval.usn)}
                            </TableCell>
                            <TableCell>{getStatusBadge(approval.status)}</TableCell>
                            <TableCell className="text-xs">
                              {summaryRequests ? (
                                <div className="space-y-1">
                                  <div>{approvedRequests} approved • {pendingRequests} pending • {rejectedRequests} rejected</div>
                                  <div className="text-muted-foreground">{totalRequests} total requests</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Summary unavailable</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {format(approval.requestedAt.toDate(), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(approval)}
                                  disabled={!canAct}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectClick(approval)}
                                  disabled={!canAct}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="mr-1 h-3 w-3" />
                                  Reject
                                </Button>
                                </div>
                                {!canAct && (
                                  <span className="text-xs text-muted-foreground">
                                    Waiting for all teacher approvals before mentor action.
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
                  Processed ({mentorProcessedApprovals.length})
                </h4>
                {mentorProcessedApprovals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No processed mentor requests.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>USN</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mentorProcessedApprovals.map((approval) => {
                        const rowKey = generateNoDueRequestId(approval.usn, approval.referenceId);
                        return (
                          <TableRow key={rowKey}>
                            <TableCell className="font-medium">{approval.studentName}</TableCell>
                            <TableCell>
                              <div className="font-medium">{approval.usn}</div>
                              {renderFeedbackBadge(approval.usn)}
                              {renderFeePaidBadge(approval.usn)}
                            </TableCell>
                            <TableCell>{getStatusBadge(approval.status)}</TableCell>
                            <TableCell className="text-xs">
                              {approval.approvedAt ? format(approval.approvedAt.toDate(), 'MMM dd, yyyy') : '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {approval.rejectionReason || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {mentorSummaries.map((summary) => {
          const mentorRequest = summary.mentorRequest;
          const mentorApproved = ['mentor_approved', 'completed', 'approved'].includes(mentorRequest?.status ?? '');
          const canAct =
            summary.readyForMentorApproval &&
            ['pending_mentor_approval', 'resubmitted'].includes(mentorRequest?.status ?? '') &&
            !processing;
          const cardKey = summary.student.usn;

          return (
            <Card key={cardKey} className="shadow-sm">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{summary.student.name}</CardTitle>
                  <CardDescription>
                    {summary.student.usn} • {summary.student.departmentId} • Section {summary.student.section} •
                    Sem {summary.student.semesterNumber ?? '—'}
                  </CardDescription>
                  {renderFeedbackBadge(summary.student.usn)}
                  {renderFeePaidBadge(summary.student.usn)}
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  {mentorApproved ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="mr-1 h-3 w-3" />Approved
                    </Badge>
                  ) : (
                    <>
                      <Badge className={summary.readyForMentorApproval ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                        {summary.readyForMentorApproval ? 'Ready for mentor approval' : 'Waiting for teachers'}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => mentorRequest && handleApprove(mentorRequest)}
                          disabled={!canAct || !mentorRequest}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mentorRequest && handleRejectClick(mentorRequest)}
                          disabled={!canAct || !mentorRequest}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary.requests.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No no-due requests generated for this student.</div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Teacher</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.requests.map((request) => {
                          const rowKey = generateNoDueRequestId(request.usn, request.referenceId);
                          return (
                            <TableRow key={rowKey}>
                              <TableCell>{formatCategoryLabel(request)}</TableCell>
                              <TableCell>{getStatusBadge(request.status)}</TableCell>
                              <TableCell>
                                <span className="font-medium">{request.teacherName}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{request.teacherEmployeeId}</span>
                              </TableCell>
                              <TableCell className="text-xs">
                                {request.approvedAt ? format(request.approvedAt.toDate(), 'MMM dd, yyyy') : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {summary.pendingCategories.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">Pending clearances</p>
                    <ul className="mt-1 list-disc pl-5">
                      {summary.pendingCategories.map((pending) => (
                        <li key={`${summary.student.usn}_${pending.referenceId}`}>
                          {pending.referenceType === 'core_subject' && 'Core • '}
                          {pending.referenceType === 'open_elective' && 'Open Elective • '}
                          {pending.referenceType === 'common_clearance' && 'Common • '}
                          {pending.referenceType === 'mentor' ? 'Mentor Clearance' : pending.referenceId} — {pending.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  })();

  return (
    <>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'teacher' | 'mentor')} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:w-auto">
          <TabsTrigger value="teacher">My Requests</TabsTrigger>
          <TabsTrigger value="mentor">Mentor Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="teacher">{teacherContent}</TabsContent>
        <TabsContent value="mentor">{mentorContent}</TabsContent>
      </Tabs>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Approval Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {selectedApproval?.studentName}'s request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Reason for Rejection *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="e.g., Pending library books not returned..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleRejectConfirm} disabled={processing || !rejectionReason.trim()}>
              {processing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                <>Confirm Rejection</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
