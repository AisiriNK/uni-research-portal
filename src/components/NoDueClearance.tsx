import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, CheckCircle2 } from "lucide-react"
import { StudentSubmissionForm } from "./StudentSubmissionForm"
import { StudentSubmissionStatus } from "./StudentSubmissionStatus"
import { TeacherApprovalDashboard } from "./TeacherApprovalDashboard"

export function NoDueClearance() {
  const { userProfile } = useAuth()
  const isStudent = userProfile?.role === 'student'
  const isTeacher = userProfile?.role === 'teacher'

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-academic-navy mb-2">Report Submission</h2>
          <p className="text-academic-gray">
            {isStudent 
              ? "Submit documents and track approval status from teachers"
              : "Review and approve/reject student document submissions"}
          </p>
        </div>

        {isStudent && (
          <Tabs defaultValue="submit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="submit">
                <Upload className="mr-2 h-4 w-4" />
                Submit Document
              </TabsTrigger>
              <TabsTrigger value="status">
                <FileText className="mr-2 h-4 w-4" />
                My Submissions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="submit" className="mt-6">
              <StudentSubmissionForm />
            </TabsContent>

            <TabsContent value="status" className="mt-6">
              <StudentSubmissionStatus />
            </TabsContent>
          </Tabs>
        )}

        {isTeacher && (
          <div className="mt-6">
            <TeacherApprovalDashboard />
          </div>
        )}

        {!isStudent && !isTeacher && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Access Denied</h3>
              <p className="text-sm text-muted-foreground text-center">
                Please log in with a student or teacher account to access this feature
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
