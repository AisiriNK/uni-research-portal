import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { 
  CheckCircle, 
  Clock, 
  FileText, 
  User, 
  Printer, 
  Package,
  MessageCircle,
  AlertCircle,
  Download
} from "lucide-react"
import { cn } from "@/lib/utils"

interface StatusStepProps {
  title: string
  description: string
  status: 'completed' | 'current' | 'pending' | 'rejected'
  date?: string
  teacherName?: string
  comments?: string
}

function StatusStep({ title, description, status, date, teacherName, comments }: StatusStepProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-status-approved" />
      case 'current':
        return <Clock className="h-5 w-5 text-status-in-progress animate-pulse" />
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-status-rejected" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-academic-gray bg-background" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'border-status-approved bg-status-approved/5'
      case 'current':
        return 'border-status-in-progress bg-status-in-progress/5'
      case 'rejected':
        return 'border-status-rejected bg-status-rejected/5'
      default:
        return 'border-academic-gray bg-academic-light-gray/30'
    }
  }

  return (
    <div className={cn("border-l-4 pl-6 pb-6 relative", getStatusColor())}>
      <div className="absolute left-[-10px] top-0 bg-background p-1 rounded-full">
        {getStatusIcon()}
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-academic-navy">{title}</h3>
          {date && (
            <span className="text-xs text-academic-gray">{date}</span>
          )}
        </div>
        
        <p className="text-sm text-academic-gray">{description}</p>
        
        {teacherName && (
          <div className="flex items-center text-xs text-academic-gray">
            <User className="mr-1 h-3 w-3" />
            Reviewer: {teacherName}
          </div>
        )}
        
        {comments && status === 'rejected' && (
          <Card className="mt-3 border-status-rejected/20 bg-status-rejected/5">
            <CardContent className="p-3">
              <div className="flex items-start space-x-2">
                <MessageCircle className="h-4 w-4 text-status-rejected mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-status-rejected">Revision Comments</h4>
                  <p className="text-xs text-academic-gray mt-1">{comments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export function ApprovalsPrinting() {
  const [currentProject] = useState({
    title: "AI-Driven Healthcare Diagnostic System",
    submissionDate: "March 15, 2024",
    studentName: "John Doe",
    studentId: "CS2021001",
    supervisor: "Dr. Sarah Johnson"
  })

  const statusSteps = [
    {
      title: "Document Submitted",
      description: "Project report uploaded and initial validation completed",
      status: 'completed' as const,
      date: "March 15, 2024"
    },
    {
      title: "Under Review",
      description: "Document is being reviewed by the assigned supervisor",
      status: 'completed' as const,
      date: "March 18, 2024",
      teacherName: "Dr. Sarah Johnson"
    },
    {
      title: "Revision Requested",
      description: "Supervisor has requested revisions to specific sections",
      status: 'rejected' as const,
      date: "March 22, 2024",
      teacherName: "Dr. Sarah Johnson",
      comments: "Please expand the methodology section with more detailed explanations of the neural network architecture. Also, include additional validation experiments to support your claims about diagnostic accuracy. The literature review needs 5-10 more recent papers from 2023-2024."
    },
    {
      title: "Resubmission Review",
      description: "Revised document under final review",
      status: 'current' as const,
      teacherName: "Dr. Sarah Johnson"
    },
    {
      title: "Final Approval",
      description: "Document approved and ready for printing",
      status: 'pending' as const
    },
    {
      title: "Sent to Print",
      description: "Document forwarded to printing department",
      status: 'pending' as const
    },
    {
      title: "Ready for Pickup",
      description: "Printed copies available for collection",
      status: 'pending' as const
    }
  ]

  const getOverallProgress = () => {
    const completedSteps = statusSteps.filter(step => step.status === 'completed').length
    const currentStep = statusSteps.findIndex(step => step.status === 'current')
    const progressValue = currentStep >= 0 ? ((completedSteps + 0.5) / statusSteps.length) * 100 : (completedSteps / statusSteps.length) * 100
    return Math.min(progressValue, 100)
  }

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-academic-navy mb-2">Approvals & Printing</h2>
          <p className="text-academic-gray">
            Track your project report approval status and printing progress
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project Overview */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Project Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-academic-gray uppercase tracking-wide">Project Title</Label>
                  <p className="text-sm font-medium text-academic-navy">{currentProject.title}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-academic-gray uppercase tracking-wide">Student</Label>
                  <p className="text-sm text-academic-navy">{currentProject.studentName}</p>
                  <p className="text-xs text-academic-gray">{currentProject.studentId}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-academic-gray uppercase tracking-wide">Supervisor</Label>
                  <p className="text-sm text-academic-navy">{currentProject.supervisor}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-academic-gray uppercase tracking-wide">Submitted</Label>
                  <p className="text-sm text-academic-navy">{currentProject.submissionDate}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Overall Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Progress value={getOverallProgress()} className="h-2" />
                  <div className="flex justify-between text-xs text-academic-gray">
                    <span>Progress</span>
                    <span>{Math.round(getOverallProgress())}% Complete</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Download Latest Version
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  View Comments History
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Contact Supervisor
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Status Timeline */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Approval Timeline</CardTitle>
                <CardDescription>
                  Track the status of your project report through each approval stage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {statusSteps.map((step, index) => (
                  <StatusStep
                    key={index}
                    title={step.title}
                    description={step.description}
                    status={step.status}
                    date={step.date}
                    teacherName={step.teacherName}
                    comments={step.comments}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper component for labels
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>
}