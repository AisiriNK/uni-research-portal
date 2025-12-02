import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Printer, CheckCircle, Clock, XCircle, FileText, ExternalLink } from 'lucide-react';
import { getAllPrintRequests, updatePrintRequestStatus } from '@/services/printService';
import { PrintRequest, PrintStatus } from '@/types/print';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export function ReprographyDashboard() {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PrintRequest | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'start' | 'complete' | 'cancel'>('start');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getAllPrintRequests();
      setRequests(data);
    } catch (err) {
      console.error('Error loading print requests:', err);
      toast({
        title: 'Error',
        description: 'Failed to load print requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (request: PrintRequest, action: 'start' | 'complete' | 'cancel') => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes('');
    setActionDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest || !userProfile) return;

    const statusMap: Record<typeof actionType, PrintStatus> = {
      start: 'in-progress',
      complete: 'completed',
      cancel: 'cancelled',
    };

    try {
      setProcessing(true);
      await updatePrintRequestStatus(selectedRequest.id, {
        status: statusMap[actionType],
        processedBy: userProfile.name,
        adminNotes: adminNotes || undefined,
        completedAt: actionType === 'complete' ? new Date() : undefined,
      });

      toast({
        title: 'Success',
        description: `Print request ${statusMap[actionType]}`,
      });

      setActionDialogOpen(false);
      loadRequests();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update print request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getPrintOptionLabel = (key: string, value: any) => {
    const labels: Record<string, Record<string, string>> = {
      colorMode: { bw: 'Black & White', color: 'Color' },
      sides: { single: 'Single Sided', double: 'Double Sided' },
      binding: { 
        none: 'No Binding', 
        staple: 'Staple', 
        'soft-bind': 'Soft Bind', 
        'spiral-bind': 'Spiral Bind' 
      },
    };
    return labels[key]?.[value] || value;
  };

  const getStatusBadge = (status: PrintStatus) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-800"><Printer className="mr-1 h-3 w-3" />In Progress</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800"><XCircle className="mr-1 h-3 w-3" />Cancelled</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  const renderRequestCard = (request: PrintRequest) => (
    <Card key={request.id} className="border">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{request.submissionTitle}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {request.studentName} • {request.studentRegNo}
              </p>
              <p className="text-xs text-muted-foreground">
                {request.studentDept} • {request.studentEmail}
              </p>
            </div>
            {getStatusBadge(request.status)}
          </div>

          {/* Print Options */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <h4 className="text-sm font-medium">Print Specifications</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Color:</span>{' '}
                <span className="font-medium">{getPrintOptionLabel('colorMode', request.printOptions.colorMode)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sides:</span>{' '}
                <span className="font-medium">{getPrintOptionLabel('sides', request.printOptions.sides)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Binding:</span>{' '}
                <span className="font-medium">{getPrintOptionLabel('binding', request.printOptions.binding)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Copies:</span>{' '}
                <span className="font-medium">{request.printOptions.copies}</span>
              </div>
            </div>
            {request.printOptions.additionalNotes && (
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground">Notes:</span>
                <p className="text-sm mt-1">{request.printOptions.additionalNotes}</p>
              </div>
            )}
          </div>

          {/* Admin Notes */}
          {request.adminNotes && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Admin Notes:</strong> {request.adminNotes}
              </p>
              {request.processedBy && (
                <p className="text-xs text-blue-600 mt-1">By {request.processedBy}</p>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Requested: {format(request.createdAt, 'MMM dd, yyyy hh:mm a')}</p>
            {request.completedAt && (
              <p className="text-green-600">Completed: {format(request.completedAt, 'MMM dd, yyyy hh:mm a')}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(request.pdfUrl, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View PDF
            </Button>

            {request.status === 'pending' && (
              <Button size="sm" onClick={() => handleAction(request, 'start')}>
                <Printer className="mr-2 h-4 w-4" />
                Start Printing
              </Button>
            )}

            {request.status === 'in-progress' && (
              <Button size="sm" onClick={() => handleAction(request, 'complete')} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Completed
              </Button>
            )}

            {(request.status === 'pending' || request.status === 'in-progress') && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleAction(request, 'cancel')}
                className="text-red-600 hover:text-red-700"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const inProgressRequests = requests.filter(r => r.status === 'in-progress');
  const completedRequests = requests.filter(r => r.status === 'completed');
  const cancelledRequests = requests.filter(r => r.status === 'cancelled');

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-academic-navy mb-2">Reprography Dashboard</h2>
          <p className="text-muted-foreground">
            Manage print requests from students
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingRequests.length}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{inProgressRequests.length}</p>
                </div>
                <Printer className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedRequests.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{requests.length}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress ({inProgressRequests.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedRequests.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelledRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Pending Requests</h3>
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map(renderRequestCard)
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-4 mt-4">
            {inProgressRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Printer className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Printing In Progress</h3>
                  <p className="text-sm text-muted-foreground">Start printing from pending requests</p>
                </CardContent>
              </Card>
            ) : (
              inProgressRequests.map(renderRequestCard)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-4">
            {completedRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Completed Requests</h3>
                  <p className="text-sm text-muted-foreground">Completed print jobs will appear here</p>
                </CardContent>
              </Card>
            ) : (
              completedRequests.map(renderRequestCard)
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4 mt-4">
            {cancelledRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Cancelled Requests</h3>
                  <p className="text-sm text-muted-foreground">Cancelled requests will appear here</p>
                </CardContent>
              </Card>
            ) : (
              cancelledRequests.map(renderRequestCard)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Confirmation Dialog */}
      {selectedRequest && (
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'start' && 'Start Printing'}
                {actionType === 'complete' && 'Mark as Completed'}
                {actionType === 'cancel' && 'Cancel Request'}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest.submissionTitle} - {selectedRequest.studentName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add any notes or comments..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={handleConfirmAction} disabled={processing}>
                {processing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                ) : (
                  <>Confirm</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
