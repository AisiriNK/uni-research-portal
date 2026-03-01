import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  getTeacherNoDueRequests,
  approveNoDueRequest,
  rejectNoDueRequest,
} from '@/services/noDueAutomationService';
import { NoDueRequestWithDetails, generateNoDueRequestId } from '@/types/schema';
import { format } from 'date-fns';

export function TeacherApprovalTable() {
  const { userProfile } = useAuth();
  const [approvals, setApprovals] = useState<NoDueRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<NoDueRequestWithDetails | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (userProfile) {
      loadApprovals();
    }
  }, [userProfile]);

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

  const handleApprove = async (approval: NoDueRequestWithDetails) => {
    try {
      setProcessing(true);
      const requestId = generateNoDueRequestId(approval.usn, approval.referenceId);
      await approveNoDueRequest(requestId);

      toast({
        title: 'Approved',
        description: `Cleared ${approval.studentName}'s ${formatCategoryLabel(approval)}`,
      });

      loadApprovals();
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
      loadApprovals();
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

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const processedApprovals = approvals.filter(a => a.status !== 'pending');
  const approvedCount = approvals.filter((a) => ['approved', 'mentor_approved', 'completed'].includes(a.status)).length;
  const rejectedCount = approvals.filter((a) => ['rejected', 'mentor_rejected'].includes(a.status)).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
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

        {/* Pending Requests */}
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
                        </TableCell>
                        <TableCell>{approval.usn}</TableCell>
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

        {/* Processed Requests */}
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
                        <TableCell>{approval.usn}</TableCell>
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

      {/* Reject Dialog */}
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
