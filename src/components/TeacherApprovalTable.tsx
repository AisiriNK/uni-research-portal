import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { getTeacherApprovals, updateApprovalStatus } from '@/services/approvalService';
import { ApprovalRequest } from '@/types/approval';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export function TeacherApprovalTable() {
  const { userProfile } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (userProfile) {
      loadApprovals();
    }
  }, [userProfile]);

  const loadApprovals = async () => {
    if (!userProfile) return;

    try {
      setLoading(true);
      const data = await getTeacherApprovals(userProfile.uid);
      setApprovals(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load approval requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval: ApprovalRequest) => {
    try {
      setProcessing(true);
      await updateApprovalStatus(approval.id, {
        status: 'approved',
        respondedAt: new Date(),
      });

      toast({
        title: 'Approved',
        description: `Approved no-due for ${approval.studentName}`,
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

  const handleRejectClick = (approval: ApprovalRequest) => {
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
      await updateApprovalStatus(selectedApproval.id, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        respondedAt: new Date(),
      });

      toast({
        title: 'Rejected',
        description: `Rejected request from ${selectedApproval.studentName}`,
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const processedApprovals = approvals.filter(a => a.status !== 'pending');

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
                <p className="text-2xl font-bold text-green-600">{approvals.filter(a => a.status === 'approved').length}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{approvals.filter(a => a.status === 'rejected').length}</p>
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
                    <TableHead>Reg No</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApprovals.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell className="font-medium">
                        {approval.studentName}
                        <div className="text-xs text-muted-foreground">{approval.studentDept}</div>
                      </TableCell>
                      <TableCell>{approval.studentRegNo}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">{approval.category.replace('_', ' ')}</Badge>
                          {approval.isResubmitted && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                              Resubmitted {approval.resubmissionCount ? `(${approval.resubmissionCount}x)` : ''}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{approval.categoryLabel}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {approval.comments || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(approval.requestedAt, 'MMM dd, yyyy')}
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
                  ))}
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
                    <TableHead>Reg No</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responded</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedApprovals.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell className="font-medium">{approval.studentName}</TableCell>
                      <TableCell>{approval.studentRegNo}</TableCell>
                      <TableCell>{approval.categoryLabel}</TableCell>
                      <TableCell>{getStatusBadge(approval.status)}</TableCell>
                      <TableCell className="text-xs">
                        {approval.respondedAt && format(approval.respondedAt, 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {approval.rejectionReason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
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
