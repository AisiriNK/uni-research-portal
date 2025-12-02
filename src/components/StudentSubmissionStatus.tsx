import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, CheckCircle, XCircle, Clock, ExternalLink, MessageSquare } from 'lucide-react';
import { getStudentSubmissions } from '@/services/noDueService';
import { NoDueSubmission } from '@/types/nodue';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export function StudentSubmissionStatus() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<NoDueSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSubmissions();
    }
  }, [user]);

  const loadSubmissions = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getStudentSubmissions(user.uid);
      setSubmissions(data);
    } catch (err) {
      console.error('Error loading submissions:', err);
      toast({
        title: 'Error',
        description: 'Failed to load your submissions',
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Submissions Yet</h3>
          <p className="text-sm text-muted-foreground">
            Your submitted documents will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Submissions</CardTitle>
        <CardDescription>
          Track the status of your no-due document submissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {submissions.map((submission) => (
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

                {/* Description */}
                {submission.metadata.description && (
                  <p className="text-sm text-gray-600">
                    {submission.metadata.description}
                  </p>
                )}

                {/* Teacher Info */}
                <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg">
                  <div>
                    <p className="font-medium">Submitted to:</p>
                    <p className="text-muted-foreground">{submission.teacherName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">
                      {format(submission.createdAt, 'MMM dd, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(submission.createdAt, 'hh:mm a')}
                    </p>
                  </div>
                </div>

                {/* Teacher Comments */}
                {submission.teacherComments && (
                  <div className={`p-3 rounded-lg border ${
                    submission.status === 'rejected' 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-start space-x-2">
                      <MessageSquare className={`h-4 w-4 mt-0.5 ${
                        submission.status === 'rejected' ? 'text-red-600' : 'text-blue-600'
                      }`} />
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          submission.status === 'rejected' ? 'text-red-800' : 'text-blue-800'
                        }`}>
                          Teacher's Comment
                        </h4>
                        <p className="text-sm text-gray-700 mt-1">
                          {submission.teacherComments}
                        </p>
                        {submission.reviewedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reviewed on {format(submission.reviewedAt, 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
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
                  <span className="text-xs text-muted-foreground">
                    {submission.pdfName}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
