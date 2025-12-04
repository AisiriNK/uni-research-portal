import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Clock, Download, AlertCircle, RefreshCw } from 'lucide-react';
import { getStudentApprovals, checkAllApprovalsComplete, getApprovedApprovalsForCertificate, resubmitApprovalRequest } from '@/services/approvalService';
import { ApprovalRequest, APPROVAL_CATEGORIES } from '@/types/approval';
import { openNoDueCertificate } from '@/services/certificateService';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface StudentApprovalStatusProps {
  academicYear: string;
  semester: string;
}

export function StudentApprovalStatus({ academicYear, semester }: StudentApprovalStatusProps) {
  const { userProfile } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [allComplete, setAllComplete] = useState(false);
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [resubmitComments, setResubmitComments] = useState('');
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    if (userProfile) {
      loadApprovals();
    }
  }, [userProfile, academicYear, semester]);

  const loadApprovals = async () => {
    if (!userProfile) return;

    try {
      setLoading(true);
      const data = await getStudentApprovals(userProfile.uid);
      
      // Filter by academic year and semester if provided
      const filtered = data.filter(
        a => a.academicYear === academicYear && a.semester === semester
      );
      
      setApprovals(filtered);

      // Check if all approvals are complete
      if (filtered.length > 0) {
        const complete = await checkAllApprovalsComplete(userProfile.uid, academicYear, semester);
        setAllComplete(complete);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load approval status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const handleResubmitClick = (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setResubmitComments(approval.comments || '');
    setResubmitDialogOpen(true);
  };

  const handleResubmitConfirm = async () => {
    if (!selectedApproval || !resubmitComments.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide comments for resubmission',
        variant: 'destructive',
      });
      return;
    }

    try {
      setResubmitting(true);
      await resubmitApprovalRequest(selectedApproval.id, resubmitComments.trim());
      
      toast({
        title: 'Resubmitted',
        description: 'Your approval request has been resubmitted',
      });

      setResubmitDialogOpen(false);
      loadApprovals();
    } catch (error) {
      console.error('Error resubmitting approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to resubmit approval request',
        variant: 'destructive',
      });
    } finally {
      setResubmitting(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!userProfile) return;

    try {
      // Get approved approvals for certificate
      const approvedApprovals = await getApprovedApprovalsForCertificate(
        userProfile.uid,
        academicYear,
        semester
      );

      if (approvedApprovals.length === 0) {
        toast({
          title: 'No Approvals',
          description: 'No approved requests found for certificate generation',
          variant: 'destructive',
        });
        return;
      }

      // Get student profile from userProfile
      const studentData = userProfile as any;
      
      const certificateData = {
        studentName: studentData.name || studentData.displayName || 'Student Name',
        studentRegNo: studentData.regNo || studentData.studentId || 'N/A',
        studentDept: studentData.department || 'N/A',
        studentBranch: studentData.branch || 'N/A',
        studentYear: studentData.year || 'N/A',
        academicYear,
        semester,
        approvals: approvedApprovals.map(a => ({
          category: a.categoryLabel,
          teacherName: a.teacherName,
          approvedAt: a.respondedAt || new Date(),
        })),
        generatedAt: new Date(),
      };

      // Open certificate in new window for printing
      openNoDueCertificate(certificateData);

      toast({
        title: 'Certificate Generated',
        description: 'Your No-Due certificate is ready to print',
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate certificate. Please try again.',
        variant: 'destructive',
      });
    }
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

  if (approvals.length === 0) {
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

  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;
  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const progressPercentage = (approvedCount / approvals.length) * 100;

  return (
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
                {approvedCount} of {approvals.length} approvals completed
              </span>
              <span className="text-sm text-muted-foreground">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              <p className="text-xs text-green-700">Approved</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-xs text-yellow-700">Pending</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
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
            {approvals.map((approval) => (
              <Card key={approval.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{approval.categoryLabel}</h4>
                        {getStatusBadge(approval.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">Category:</span>{' '}
                          <span className="font-medium">
                            {APPROVAL_CATEGORIES[approval.category]}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Teacher:</span>{' '}
                          <span className="font-medium">{approval.teacherName}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Requested:</span>{' '}
                          <span>{format(approval.requestedAt, 'MMM dd, yyyy')}</span>
                        </div>
                        {approval.respondedAt && (
                          <div>
                            <span className="text-muted-foreground">Responded:</span>{' '}
                            <span>{format(approval.respondedAt, 'MMM dd, yyyy')}</span>
                          </div>
                        )}
                      </div>

                      {approval.comments && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Your comments:</span>{' '}
                          <span className="italic">{approval.comments}</span>
                        </div>
                      )}

                      {approval.status === 'rejected' && approval.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Rejection Reason:
                          </p>
                          <p className="text-sm text-red-700 mt-1">{approval.rejectionReason}</p>
                          <Button
                            size="sm"
                            onClick={() => handleResubmitClick(approval)}
                            className="mt-2 bg-blue-600 hover:bg-blue-700"
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Resubmit Request
                          </Button>
                        </div>
                      )}

                      {approval.isResubmitted && (
                        <div className="mt-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Resubmitted {approval.resubmissionCount ? `(${approval.resubmissionCount}x)` : ''}
                          </Badge>
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

      {/* Resubmit Dialog */}
      <Dialog open={resubmitDialogOpen} onOpenChange={setResubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resubmit Approval Request</DialogTitle>
            <DialogDescription>
              Update your comments to address the rejection reason and resubmit to {selectedApproval?.teacherName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedApproval?.rejectionReason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm font-medium text-red-800">Previous Rejection Reason:</p>
                <p className="text-sm text-red-700 mt-1">{selectedApproval.rejectionReason}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resubmit-comments">Updated Comments *</Label>
              <Textarea
                id="resubmit-comments"
                placeholder="Explain how you've addressed the concerns..."
                value={resubmitComments}
                onChange={(e) => setResubmitComments(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubmitDialogOpen(false)} disabled={resubmitting}>
              Cancel
            </Button>
            <Button onClick={handleResubmitConfirm} disabled={resubmitting || !resubmitComments.trim()}>
              {resubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resubmitting...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" />Resubmit Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
