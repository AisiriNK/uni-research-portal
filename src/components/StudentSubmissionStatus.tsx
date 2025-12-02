import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, CheckCircle, XCircle, Clock, ExternalLink, MessageSquare, Printer } from 'lucide-react';
import { getStudentSubmissions } from '@/services/noDueService';
import { getPrintRequestBySubmission, createPrintRequest } from '@/services/printService';
import { NoDueSubmission } from '@/types/nodue';
import { PrintRequest, PrintOptions } from '@/types/print';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PrintRequestForm } from './PrintRequestForm';

export function StudentSubmissionStatus() {
  const { user, userProfile } = useAuth();
  const [submissions, setSubmissions] = useState<NoDueSubmission[]>([]);
  const [printRequests, setPrintRequests] = useState<Map<string, PrintRequest>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<NoDueSubmission | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

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
      
      // Load print requests for all submissions
      const printReqMap = new Map<string, PrintRequest>();
      for (const submission of data) {
        const printReq = await getPrintRequestBySubmission(submission.id);
        if (printReq) {
          printReqMap.set(submission.id, printReq);
        }
      }
      setPrintRequests(printReqMap);
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

  const handlePrintRequest = (submission: NoDueSubmission) => {
    setSelectedSubmission(submission);
    setPrintDialogOpen(true);
  };

  const handleSubmitPrintRequest = async (options: PrintOptions) => {
    if (!selectedSubmission || !userProfile) return;

    try {
      await createPrintRequest(
        {
          id: userProfile.uid,
          name: userProfile.name,
          email: userProfile.email,
          dept: userProfile.dept,
          regNo: 'regNo' in userProfile ? userProfile.regNo : '',
        },
        {
          submissionId: selectedSubmission.id,
          submissionTitle: selectedSubmission.metadata.title,
          pdfUrl: selectedSubmission.pdfUrl,
          pdfName: selectedSubmission.pdfName,
          printOptions: options,
        }
      );

      toast({
        title: 'Success',
        description: 'Print request submitted successfully',
      });

      // Reload to show updated print status
      loadSubmissions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit print request',
        variant: 'destructive',
      });
    }
  };

  const getPrintStatusBadge = (printRequest: PrintRequest) => {
    switch (printRequest.status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <Printer className="mr-1 h-3 w-3" />
            Print Completed
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Printer className="mr-1 h-3 w-3" />
            Printing...
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Printer className="mr-1 h-3 w-3" />
            Print Pending
          </Badge>
        );
      default:
        return null;
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
    <>
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

                {/* Print Status - Show prominently if print request exists */}
                {submission.status === 'approved' && printRequests.has(submission.id) && (
                  <div className={`p-3 rounded-lg border ${
                    printRequests.get(submission.id)!.status === 'completed'
                      ? 'bg-green-50 border-green-200'
                      : printRequests.get(submission.id)!.status === 'in-progress'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-start space-x-2">
                      <Printer className={`h-4 w-4 mt-0.5 ${
                        printRequests.get(submission.id)!.status === 'completed'
                          ? 'text-green-600'
                          : printRequests.get(submission.id)!.status === 'in-progress'
                          ? 'text-blue-600'
                          : 'text-yellow-600'
                      }`} />
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          printRequests.get(submission.id)!.status === 'completed'
                            ? 'text-green-800'
                            : printRequests.get(submission.id)!.status === 'in-progress'
                            ? 'text-blue-800'
                            : 'text-yellow-800'
                        }`}>
                          Print Status: {
                            printRequests.get(submission.id)!.status === 'completed'
                              ? '✓ Completed - Ready for Collection'
                              : printRequests.get(submission.id)!.status === 'in-progress'
                              ? 'Currently Printing...'
                              : 'Pending in Print Queue'
                          }
                        </h4>
                        <div className="text-sm text-gray-700 mt-2 space-y-1">
                          <p>
                            <strong>Copies:</strong> {printRequests.get(submission.id)!.printOptions.copies} | 
                            <strong> Color:</strong> {printRequests.get(submission.id)!.printOptions.colorMode === 'bw' ? 'B&W' : 'Color'} | 
                            <strong> Sides:</strong> {printRequests.get(submission.id)!.printOptions.sides === 'single' ? 'Single' : 'Double'}
                          </p>
                          <p>
                            <strong>Binding:</strong> {
                              printRequests.get(submission.id)!.printOptions.binding === 'none' ? 'None' :
                              printRequests.get(submission.id)!.printOptions.binding === 'staple' ? 'Staple' :
                              printRequests.get(submission.id)!.printOptions.binding === 'soft-bind' ? 'Soft Bind' :
                              'Spiral Bind'
                            }
                          </p>
                        </div>
                        {printRequests.get(submission.id)!.adminNotes && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Admin Notes:</strong> {printRequests.get(submission.id)!.adminNotes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Requested on {format(printRequests.get(submission.id)!.createdAt, 'MMM dd, yyyy hh:mm a')}
                          {printRequests.get(submission.id)!.completedAt && (
                            <> • Completed on {format(printRequests.get(submission.id)!.completedAt, 'MMM dd, yyyy hh:mm a')}</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(submission.pdfUrl, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Document
                    </Button>
                    
                    {/* Print Button - Only for Approved Submissions without print request */}
                    {submission.status === 'approved' && !printRequests.has(submission.id) && (
                      <Button
                        size="sm"
                        onClick={() => handlePrintRequest(submission)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Send to Print
                      </Button>
                    )}
                  </div>
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
    
    {/* Print Request Form Dialog */}
    {selectedSubmission && (
      <PrintRequestForm
        open={printDialogOpen}
        onClose={() => {
          setPrintDialogOpen(false);
          setSelectedSubmission(null);
        }}
        onSubmit={handleSubmitPrintRequest}
        submissionTitle={selectedSubmission.metadata.title}
      />
    )}
  </>
  );
}
