import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Upload, 
  CheckCircle, 
  Clock, 
  XCircle,
  FileText,
  Building,
  Download,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Department {
  id: string
  name: string
  status: 'pending' | 'approved' | 'rejected'
  icon: any
  description: string
  lastUpdated?: string
  comments?: string
}

interface ClearanceDocumentProps {
  title: string
  description: string
  required: boolean
  uploaded: boolean
  onUpload: () => void
}

function ClearanceDocument({ title, description, required, uploaded, onUpload }: ClearanceDocumentProps) {
  return (
    <Card className="border border-border hover:shadow-card transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-medium text-academic-navy">{title}</h3>
              {required && (
                <Badge variant="destructive" className="text-xs">Required</Badge>
              )}
            </div>
            <p className="text-sm text-academic-gray">{description}</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {uploaded ? (
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-status-approved" />
                <span className="text-sm text-status-approved font-medium">Uploaded</span>
              </div>
            ) : (
              <Button 
                onClick={onUpload}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                <Upload className="mr-1 h-3 w-3" />
                Upload
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface DepartmentStatusProps {
  department: Department
}

function DepartmentStatus({ department }: DepartmentStatusProps) {
  const getStatusIcon = () => {
    switch (department.status) {
      case 'approved':
        return <CheckCircle className="h-6 w-6 text-status-approved" />
      case 'rejected':
        return <XCircle className="h-6 w-6 text-status-rejected" />
      default:
        return <Clock className="h-6 w-6 text-status-pending" />
    }
  }

  const getStatusColor = () => {
    switch (department.status) {
      case 'approved':
        return 'border-status-approved/20 bg-status-approved/5'
      case 'rejected':
        return 'border-status-rejected/20 bg-status-rejected/5'
      default:
        return 'border-status-pending/20 bg-status-pending/5'
    }
  }

  const getStatusText = () => {
    switch (department.status) {
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Action Required'
      default:
        return 'Pending Review'
    }
  }

  return (
    <Card className={cn("border-l-4", getStatusColor())}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <department.icon className="h-8 w-8 text-academic-blue" />
            <div>
              <h3 className="font-semibold text-academic-navy">{department.name}</h3>
              <p className="text-xs text-academic-gray">{department.description}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="flex items-center space-x-2">
                {getStatusIcon()}
                <span className={cn(
                  "text-sm font-medium",
                  department.status === 'approved' && "text-status-approved",
                  department.status === 'rejected' && "text-status-rejected",
                  department.status === 'pending' && "text-status-pending"
                )}>
                  {getStatusText()}
                </span>
              </div>
              {department.lastUpdated && (
                <p className="text-xs text-academic-gray mt-1">
                  {department.lastUpdated}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {department.comments && department.status === 'rejected' && (
          <div className="mt-3 p-3 bg-status-rejected/5 border border-status-rejected/20 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-status-rejected mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-status-rejected">Action Required</h4>
                <p className="text-xs text-academic-gray mt-1">{department.comments}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function NoDueClearance() {
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set(['library-clearance', 'fee-receipt']))

  const departments: Department[] = [
    {
      id: 'library',
      name: 'Library',
      status: 'approved',
      icon: FileText,
      description: 'Book returns and fine clearance',
      lastUpdated: 'Approved on March 20, 2024'
    },
    {
      id: 'hostel',
      name: 'Hostel',
      status: 'rejected',
      icon: Building,
      description: 'Room clearance and damage assessment',
      lastUpdated: 'Last reviewed March 18, 2024',
      comments: 'Room key not returned. Please submit room key and pay pending electricity bill of ₹250.'
    },
    {
      id: 'department',
      name: 'Department Head',
      status: 'pending',
      icon: Building,
      description: 'Academic clearance and project completion',
      lastUpdated: 'Submitted March 15, 2024'
    },
    {
      id: 'accounts',
      name: 'Accounts',
      status: 'approved',
      icon: FileText,
      description: 'Fee payment verification',
      lastUpdated: 'Approved on March 22, 2024'
    },
    {
      id: 'exam',
      name: 'Examination Cell',
      status: 'pending',
      icon: FileText,
      description: 'Academic record verification',
      lastUpdated: 'Submitted March 15, 2024'
    },
    {
      id: 'placement',
      name: 'Training & Placement',
      status: 'approved',
      icon: Building,
      description: 'Placement record clearance',
      lastUpdated: 'Approved on March 19, 2024'
    }
  ]

  const clearanceDocuments = [
    {
      title: "Library Clearance Certificate",
      description: "Certificate confirming no pending books or fines",
      required: true,
      uploaded: uploadedDocs.has('library-clearance')
    },
    {
      title: "Fee Payment Receipt",
      description: "Final semester fee payment confirmation",
      required: true,
      uploaded: uploadedDocs.has('fee-receipt')
    },
    {
      title: "Hostel Clearance Form",
      description: "Room clearance and damage assessment form",
      required: true,
      uploaded: uploadedDocs.has('hostel-clearance')
    },
    {
      title: "Project Completion Certificate",
      description: "Department verification of project completion",
      required: true,
      uploaded: uploadedDocs.has('project-certificate')
    },
    {
      title: "Medical Clearance",
      description: "Medical center clearance (if applicable)",
      required: false,
      uploaded: uploadedDocs.has('medical-clearance')
    }
  ]

  const handleDocumentUpload = (docId: string) => {
    setUploadedDocs(prev => new Set([...prev, docId]))
  }

  const getOverallProgress = () => {
    const approvedDepts = departments.filter(dept => dept.status === 'approved').length
    return (approvedDepts / departments.length) * 100
  }

  const getUploadProgress = () => {
    const requiredDocs = clearanceDocuments.filter(doc => doc.required)
    const uploadedRequired = requiredDocs.filter(doc => doc.uploaded).length
    return (uploadedRequired / requiredDocs.length) * 100
  }

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-academic-navy mb-2">No-Due Clearance</h2>
          <p className="text-academic-gray">
            Upload required documents and track clearance status from all departments
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Upload className="mr-2 h-5 w-5" />
                  Document Upload
                </CardTitle>
                <CardDescription>
                  Upload all required clearance documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium">Upload Progress</span>
                    <span className="text-sm text-academic-gray">{Math.round(getUploadProgress())}%</span>
                  </div>
                  <Progress value={getUploadProgress()} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {clearanceDocuments.map((doc, index) => (
                <ClearanceDocument
                  key={index}
                  title={doc.title}
                  description={doc.description}
                  required={doc.required}
                  uploaded={doc.uploaded}
                  onUpload={() => handleDocumentUpload(doc.title.toLowerCase().replace(/\s+/g, '-'))}
                />
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Download Forms
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  View Guidelines
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Status Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clearance Progress</CardTitle>
                <CardDescription>
                  Overall department clearance status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <span className="text-sm text-academic-gray">
                      {departments.filter(d => d.status === 'approved').length} of {departments.length} departments cleared
                    </span>
                  </div>
                  <Progress value={getOverallProgress()} className="h-3" />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {departments.map((department) => (
                <DepartmentStatus key={department.id} department={department} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}