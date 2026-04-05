import { useEffect, useState } from "react"
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StudentApprovalStatus } from './StudentApprovalStatus';
import { TeacherApprovalTable } from './TeacherApprovalTable';
import { getStudentHallTicket } from '@/services/hallTicketService';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, ClipboardCheck, Download } from "lucide-react"

export function ApprovalsPrinting() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [semester, setSemester] = useState('1');
  const [hallTicket, setHallTicket] = useState<{
    downloadUrl: string;
    semesterNumber: number;
    generatedAt?: Date;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const isStudent = userProfile?.role === 'student';
  const isTeacher = userProfile?.role === 'teacher';

  useEffect(() => {
    let isMounted = true;

    const loadHallTicket = async () => {
      if (!userProfile || userProfile.role !== 'student' || !('usn' in userProfile)) {
        return;
      }

      try {
        const ticket = await getStudentHallTicket(userProfile.usn);
        if (isMounted) {
          setHallTicket(ticket);
        }
      } catch (error) {
        console.error('Failed to load hall ticket:', error);
      }
    };

    loadHallTicket();

    return () => {
      isMounted = false;
    };
  }, [userProfile]);

  const handleDownloadHallTicket = async () => {
    if (!hallTicket || !userProfile || !('usn' in userProfile)) return;

    try {
      setDownloading(true);
      let downloadUrl = hallTicket.downloadUrl;
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      
      // Convert relative URLs to absolute
      if (!downloadUrl.startsWith('http')) {
        downloadUrl = `${BACKEND_URL}${downloadUrl}`;
      }
      
      // Fetch and download the file
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HallTicket_${userProfile.usn}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: 'Hall ticket downloaded successfully',
      });
    } catch (error: any) {
      console.error('Error downloading hall ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to download hall ticket',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  if (isTeacher) {
    return (
      <div className="h-full bg-background">
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-academic-navy mb-2">No-Due Clearance Approvals</h2>
            <p className="text-academic-gray">
              Review and approve/reject student clearance requests
            </p>
          </div>

          <TeacherApprovalTable />
        </div>
      </div>
    );
  }

  if (isStudent) {
    return (
      <div className="h-full bg-background">
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-academic-navy mb-2">No-Due Clearance</h2>
            <p className="text-academic-gray">
              Request approvals from teachers and departments for no-due clearance
            </p>
          </div>

          {/* Academic Year and Semester Selection */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Academic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="academicYear">Academic Year</Label>
                  <Input
                    id="academicYear"
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="e.g., 2024"
                  />
                </div>
                <div>
                  <Label htmlFor="semester">Semester</Label>
                  <Input
                    id="semester"
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="e.g., 1 or 2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Hall Ticket</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {hallTicket?.downloadUrl ? (
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Semester {hallTicket.semesterNumber}
                    {hallTicket.generatedAt && (
                      <> · Issued {hallTicket.generatedAt.toLocaleDateString('en-IN')}</>
                    )}
                  </div>
                  <Button onClick={handleDownloadHallTicket} disabled={downloading}>
                    <Download className="h-4 w-4 mr-2" />
                    {downloading ? 'Downloading...' : 'Download Hall Ticket'}
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Hall ticket not available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="status" className="space-y-6">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="status" className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                My Status
              </TabsTrigger>
            </TabsList>

            <TabsContent value="status">
              <StudentApprovalStatus 
                academicYear={academicYear} 
                semester={semester} 
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-academic-gray">Access restricted to students and teachers</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}