import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { getTeacherSubmissions, updateSubmissionStatus } from '@/services/noDueService';
import { NoDueSubmission } from '@/types/nodue';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export function TeacherApprovalDashboard() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<NoDueSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<NoDueSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (user) {
      loadSubmissions();
    }
  }, [user]);

  const loadSubmissions = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getTeacherSubmissions(user.uid);
      setSubmissions(data);
    } catch (err) {
      console.error('Error loading submissions:', err);
      toast({
        title: 'Error',
        description: 'Failed to load submissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openReviewDialog = (submission: NoDueSubmission, action: 'approve' | 'reject') => {
    setSelectedSubmission(submission);
    setReviewAction(action);
    setComments('');
    setReviewDialog(true);
  };

  const handleReview = async () => {
    if (!selectedSubmission) return;

    if (reviewAction === 'reject' && !comments.trim()) {
      toast({
        title: 'Comments Required',
        description: 'Please provide a reason for rejection',
        variant: 'destructive',
      });
      return;
    }

    setProcessingId(selectedSubmission.id);

    try {
      await updateSubmissionStatus(selectedSubmission.id, {
        status: reviewAction === 'approve' ? 'approved' : 'rejected',
        teacherComments: comments,
        reviewedAt: new Date(),
      });

      toast({
        title: 'Success!',
        description: `Submission ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully.`,
      });

      setReviewDialog(false);
      setSelectedSubmission(null);
      setComments('');
      
      // Reload submissions
      await loadSubmissions();
    } catch (err) {
      console.error('Error updating submission:', err);
      toast({
        title: 'Error',
        description: 'Failed to update submission',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const pendingSubmissions = submissions.filter(s => s.status === 'pending');
  const reviewedSubmissions = submissions.filter(s => s.status !== 'pending');

  const SubmissionCard = ({ submission }: { submission: NoDueSubmission }) => (
    <Card key={submission.id} className="border">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{submission.metadata.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Category: {submission.metadata.category}
              </p>
            </div>
            <div>
              {getStatusBadge(submission.status)}
            </div>
          </div>

          {/* Student Info */}
          <div className="bg-blue-50 p-3 rounded-lg space-y-1">
            <p className="text-sm font-medium">Student Information</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <span className="ml-2 font-medium">{submission.studentName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Reg No:</span>
                <span className="ml-2 font-medium">{submission.studentRegNo}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Department:</span>
                <span className="ml-2 font-medium">{submission.studentDept}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <span className="ml-2 text-xs">{submission.studentEmail}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {submission.metadata.description && (
            <div>
              <p className="text-sm font-medium mb-1">Description:</p>
              <p className="text-sm text-gray-600">{submission.metadata.description}</p>
            </div>
          )}

          {/* Submission Date */}
          <p className="text-xs text-muted-foreground">
            Submitted on {format(submission.createdAt, 'MMM dd, yyyy')} at {format(submission.createdAt, 'hh:mm a')}
          </p>

          {/* Teacher Comments (if reviewed) */}
          {submission.teacherComments && (
            <div className="bg-gray-50 p-3 rounded-lg border">
              <p className="text-sm font-medium mb-1">Your Comments:</p>
              <p className="text-sm text-gray-600">{submission.teacherComments}</p>
              {submission.reviewedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Reviewed on {format(submission.reviewedAt, 'MMM dd, yyyy')}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(submission.pdfUrl, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Document
            </Button>

            {submission.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openReviewDialog(submission, 'reject')}
                  disabled={processingId === submission.id}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => openReviewDialog(submission, 'approve')}
                  disabled={processingId === submission.id}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
      <Card>
        <CardHeader>
          <CardTitle>Student Submissions</CardTitle>
          <CardDescription>
            Review and approve/reject no-due document submissions from students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">
                Pending ({pendingSubmissions.length})
              </TabsTrigger>
              <TabsTrigger value="reviewed">
                Reviewed ({reviewedSubmissions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4 mt-4">
              {pendingSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Pending Submissions</h3>
                  <p className="text-sm text-muted-foreground">
                    New submissions from students will appear here
                  </p>
                </div>
              ) : (
                pendingSubmissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))
              )}
            </TabsContent>

            <TabsContent value="reviewed" className="space-y-4 mt-4">
              {reviewedSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Reviewed Submissions</h3>
                  <p className="text-sm text-muted-foreground">
                    Approved and rejected submissions will appear here
                  </p>
                </div>
              ) : (
                reviewedSubmissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Submission
            </DialogTitle>
            <DialogDescription>
              {selectedSubmission && (
                <>
                  {reviewAction === 'approve' 
                    ? 'Approve this submission from ' 
                    : 'Reject this submission from '}
                  <strong>{selectedSubmission.studentName}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comments">
                Comments {reviewAction === 'reject' && '*'}
              </Label>
              <Textarea
                id="comments"
                placeholder={
                  reviewAction === 'approve'
                    ? 'Add optional feedback for the student...'
                    : 'Explain why this submission is being rejected...'
                }
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
              />
              {reviewAction === 'reject' && (
                <p className="text-xs text-muted-foreground">
                  Please provide a clear reason for rejection to help the student
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialog(false)}
              disabled={processingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={processingId !== null}
            >
              {processingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {reviewAction === 'approve' ? (
                    <><ThumbsUp className="mr-2 h-4 w-4" />Approve</>
                  ) : (
                    <><ThumbsDown className="mr-2 h-4 w-4" />Reject</>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
