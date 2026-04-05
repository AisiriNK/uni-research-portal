import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, Download, Eye, Sparkles, Plus, Minus, CheckCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "@/config/firebase"

interface TeamMember {
  name: string
  usn: string
}

interface Chapter {
  title: string
  content: string
  images: ImageData[]
}

interface ImageData {
  filename: string
  caption: string
  data: string // base64 encoded image data
}

interface ProcessingStatus {
  stage: string
  progress: number
  message: string
}

interface TeacherOption {
  id: string
  name: string
  designation: string
  departmentId: string
}

interface BackendResult {
  chapters: Chapter[]
  files?: { [filename: string]: string }
  mergedPdfBase64?: string | null
  mergedPdfName?: string | null
  wordFileBase64?: string | null
  wordFileName?: string | null
}

interface ValidationIssue {
  severity: "warning" | "critical"
  label: string
  message: string
  suggestion?: string
  location?: string
  example?: string
  correction?: string
}

interface ValidationSummary {
  critical: number
  warnings: number
  images: number
  figureCaptions: number
  tableCaptions: number
}

export function AIReportFormatter() {
  const { user } = useAuth()
  const [sourceDocument, setSourceDocument] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({ stage: '', progress: 0, message: '' })
  const [extractedChapters, setExtractedChapters] = useState<Chapter[]>([])
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewPdfName, setPreviewPdfName] = useState<string | null>(null)
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null)
  const [wordDownloadName, setWordDownloadName] = useState<string | null>(null)
  const [wordDownloadBase64, setWordDownloadBase64] = useState<string | null>(null)
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [selectedTeacherDesignation, setSelectedTeacherDesignation] = useState("")
  const [hodName, setHodName] = useState("")
  const [hodDesignation, setHodDesignation] = useState("")
  const [hodDepartment, setHodDepartment] = useState("")
  const [selectedTeacherId, setSelectedTeacherId] = useState("")
  const [subjectCode, setSubjectCode] = useState("")
  const [subjectName, setSubjectName] = useState("")
  const [semester, setSemester] = useState("")
  const [studentLookupBlocked, setStudentLookupBlocked] = useState(false)
  
  // Team and project details
  const [numTeamMembers, setNumTeamMembers] = useState<number>(1)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([{ name: "", usn: "" }])
  const [guideName, setGuideName] = useState("")
  const [guideDepartment, setGuideDepartment] = useState("")
  const [year, setYear] = useState("")
  const [projectTitle, setProjectTitle] = useState("")
  const [principalName] = useState("S Y Kulkarni")
  const [principalDesignation1] = useState("Additional Director")
  const [principalDesignation2] = useState("and Principal")
  const [abstractContent, setAbstractContent] = useState("")

  const departmentNames: Record<string, string> = {
    CSE: "Computer Science and Engineering",
    ECE: "Electronics and Communication Engineering",
    ME: "Mechanical Engineering",
    CE: "Civil Engineering",
    EEE: "Electrical and Electronics Engineering",
    ISE: "Information Science and Engineering",
    AIML: "Artificial Intelligence and Machine Learning",
  }

  const resolveDepartmentName = (deptId: string) => {
    if (!deptId) return ""
    const normalized = deptId.toUpperCase()
    return departmentNames[normalized] || deptId
  }

  const resolveDepartmentLabel = (deptId: string) => {
    if (!deptId) return ""
    const normalized = deptId.toUpperCase()
    if (normalized.startsWith("DEPARTMENT OF")) {
      return deptId
    }
    if (departmentNames[normalized]) {
      return `Department of ${normalized}`
    }
    return deptId.toLowerCase().startsWith("department of ") ? deptId : `Department of ${deptId}`
  }

  useEffect(() => {
    const loadTeachers = async () => {
      setTeachersLoading(true)
      try {
        const snapshot = await getDocs(collection(db, 'teachers'))
        const records: TeacherOption[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any
          const designation = (data.designation || data.role || data.teacherRole || '').toString()
          return {
            id: docSnap.id,
            name: data.name || '',
            designation,
            departmentId: data.departmentId || data.dept || '',
          }
        })
        const ordered = records
          .filter((item) => item.name)
          .sort((a, b) => a.name.localeCompare(b.name))
        setTeachers(ordered)

        if (user?.departmentId) {
          const dept = user.departmentId.toLowerCase()
          const hodMatch = ordered.find((teacher) =>
            teacher.departmentId?.toLowerCase() === dept &&
            teacher.designation?.toLowerCase() === 'professor and hod'
          )
          setHodName(hodMatch?.name || '')
          setHodDesignation(hodMatch?.designation || '')
          setHodDepartment(resolveDepartmentLabel(user.departmentId))
        } else {
          setHodName('')
          setHodDesignation('')
          setHodDepartment('')
        }
      } catch (error) {
        console.error('Error loading teachers:', error)
      } finally {
        setTeachersLoading(false)
      }
    }

    loadTeachers()
  }, [user?.departmentId])

  const primaryUsn = teamMembers[0]?.usn?.trim()

  useEffect(() => {
    const loadStudentContext = async () => {
      if (!primaryUsn) {
        setSemester("")
        return
      }

      if (studentLookupBlocked) {
        return
      }

      try {
        const studentSnap = await getDoc(doc(db, "students", primaryUsn))
        if (!studentSnap.exists()) {
          setSemester("")
          return
        }
        const studentData = studentSnap.data() as any
        const semesterValue =
          studentData.currentSemester ??
          studentData.semesterNumber ??
          studentData.semester ??
          ""
        setSemester(semesterValue ? String(semesterValue) : "")
      } catch (error: any) {
        if (error?.code === "permission-denied" || String(error?.message || "").includes("permission-denied")) {
          setStudentLookupBlocked(true)
          setSemester("")
          return
        }
        console.error("Error loading student details:", error)
      }
    }

    loadStudentContext()
  }, [primaryUsn, studentLookupBlocked, user?.departmentId])

  const handleSourceDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && (file.name.endsWith('.doc') || file.name.endsWith('.docx'))) {
      setSourceDocument(file)
    } else {
      alert('Please upload a .doc or .docx file')
    }
  }

  const handleNumTeamMembersChange = (num: number) => {
    setNumTeamMembers(num)
    const newTeamMembers = Array.from({ length: num }, (_, i) => 
      teamMembers[i] || { name: "", usn: "" }
    )
    setTeamMembers(newTeamMembers)
  }

  const handleTeamMemberChange = (index: number, field: keyof TeamMember, value: string) => {
    const newTeamMembers = [...teamMembers]
    newTeamMembers[index] = { ...newTeamMembers[index], [field]: value }
    setTeamMembers(newTeamMembers)
  }

  const updateProcessingStatus = (stage: string, progress: number, message: string) => {
    setProcessingStatus({ stage, progress, message })
  }

  const processDocumentWithBackend = async (
    file: File,
    projectDetails: {
      title: string
      guide: string
      subjectCode: string
      subjectName: string
      year: string
      teamMembers: TeamMember[]
    }
  ): Promise<BackendResult> => {
    try {
      updateProcessingStatus('uploading', 25, 'Uploading document to backend...')
      
      // Prepare form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('project_title', projectDetails.title)
      formData.append('guide_name', projectDetails.guide)
      formData.append('guide_designation', selectedTeacherDesignation)
      formData.append('guide_department', guideDepartment)
      formData.append('subject_code', projectDetails.subjectCode)
      formData.append('subject_name', projectDetails.subjectName)
      formData.append('hod_name', hodName)
      formData.append('hod_designation', hodDesignation)
      formData.append('hod_department', hodDepartment)
      formData.append('principal_name', principalName)
      formData.append('principal_designation', principalDesignation1)
      formData.append('principal_designation2', principalDesignation2)
      formData.append('semester', semester)
      formData.append('abstract_content', abstractContent)
      formData.append('year', projectDetails.year)
      if (user?.departmentId) {
        formData.append('dept', resolveDepartmentName(user.departmentId))
      }
      formData.append('team_members_json', JSON.stringify(projectDetails.teamMembers))
      
      console.log('Sending request to backend with:', {
        filename: file.name,
        fileSize: file.size,
        projectTitle: projectDetails.title,
        teamMembers: projectDetails.teamMembers.length
      })
      
      updateProcessingStatus('processing', 50, 'Processing document with AI...')
      
      // Send to backend with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout
      
      let response: Response
      
      try {
        response = await fetch('http://localhost:8000/api/process-document', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out - processing is taking too long. Please try with a smaller document.')
        }
        throw fetchError
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }
      
      updateProcessingStatus('parsing', 75, 'Parsing response...')
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Backend processing failed')
      }
      
      // Transform backend response to frontend format
      const chapters: Chapter[] = result.chapters.map((ch: any) => ({
        title: ch.title,
        content: ch.content,
        images: ch.images || []
      }))
      
      return {
        chapters,
        files: result.files,
        mergedPdfBase64: result.merged_pdf_base64,
        mergedPdfName: result.merged_pdf_name,
        wordFileBase64: result.word_file_base64,
        wordFileName: result.word_file_name
      }
      
    } catch (error) {
      console.error('Backend processing error:', error)
      throw new Error(`Backend processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleProcess = async () => {
    if (!sourceDocument) {
      alert('Please upload source document')
      return
    }

    if (!projectTitle || !guideName || !subjectCode || !subjectName || !year || teamMembers.some(member => !member.name || !member.usn)) {
      alert('Please fill in all project details and team member information')
      return
    }

    setIsProcessing(true)
    setProcessingStatus({ stage: 'starting', progress: 0, message: 'Initializing document processing...' })

    try {
      // Prepare project details
      const projectDetails = {
        title: projectTitle,
        guide: guideName,
        subjectCode: subjectCode,
        subjectName: subjectName,
        year: year,
        teamMembers: teamMembers
      }
      
      // Process with backend
      const { chapters, mergedPdfBase64, mergedPdfName, wordFileBase64, wordFileName } = await processDocumentWithBackend(sourceDocument, projectDetails)
      
      setExtractedChapters(chapters)

      if (mergedPdfBase64) {
        const pdfBlob = base64ToBlob(mergedPdfBase64, 'application/pdf')
        const pdfUrl = URL.createObjectURL(pdfBlob)
        setPreviewPdfUrl(pdfUrl)
        setPreviewPdfName(mergedPdfName || 'report.pdf')
        setPreviewPdfBase64(mergedPdfBase64)
      }

      if (wordFileBase64) {
        setWordDownloadBase64(wordFileBase64)
        setWordDownloadName(wordFileName || 'report.docx')
      }
      
      updateProcessingStatus('complete', 100, `Successfully processed ${chapters.length} chapters`)
      
    } catch (error) {
      console.error('Processing error:', error)
      updateProcessingStatus('error', 0, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleValidate = async () => {
    if (!sourceDocument) {
      alert('Please upload source document')
      return
    }

    setValidationLoading(true)
    setValidationError(null)
    setValidationIssues([])
    setValidationSummary(null)

    try {
      const formData = new FormData()
      formData.append('file', sourceDocument)

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/validate-document`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Validation failed' }))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const result = await response.json()
      setValidationIssues(result.issues || [])
      setValidationSummary(result.summary || null)
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Validation failed')
    } finally {
      setValidationLoading(false)
    }
  }

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  const downloadBase64File = (filename: string, base64: string, mimeType: string) => {
    const blob = base64ToBlob(base64, mimeType)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getWordMimeType = (filename: string) => {
    return filename.toLowerCase().endsWith('.doc')
      ? 'application/msword'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/templates/report-content-format')
      
      if (!response.ok) {
        throw new Error('Failed to download template')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'report_content_format.docx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading template:', error)
      alert('Failed to download template. Please try again.')
    }
  }

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-academic-navy mb-2">Automated Document Processor</h2>
          <p className="text-academic-gray">
            Convert Word documents to Typst using AI - Upload source document (.doc/.docx) 
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Upload className="mr-2 h-5 w-5" />
                  Document Upload
                </CardTitle>
                <CardDescription>
                  Upload your source document (.doc/.docx)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="source-document">Source Document (.doc/.docx)</Label>
                    <Input
                      id="source-document"
                      type="file"
                      accept=".doc,.docx"
                      onChange={handleSourceDocumentUpload}
                      className="mt-1"
                    />
                    {sourceDocument && (
                      <div className="mt-2 flex items-center space-x-2">
                        <FileText size={16} className="text-academic-blue" />
                        <span className="text-sm text-academic-gray">
                          {sourceDocument.name}
                        </span>
                        <Badge variant="secondary">Uploaded</Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <FileText size={16} />
                      Report Template
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Download the report content format template to use as a reference for your report structure
                    </p>
                    <Button 
                      onClick={handleDownloadTemplate}
                      variant="outline"
                      className="w-full"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Report Content Format Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Details</CardTitle>
                <CardDescription>
                  Enter project information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="project-title">Project Title</Label>
                    <Input
                      id="project-title"
                      placeholder="Enter your project title"
                      className="mt-1"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="year">Academic Year</Label>
                    <Input
                      id="year"
                      placeholder="Enter academic year (e.g., 2025-26)"
                      className="mt-1"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Members</CardTitle>
                <CardDescription>
                  Enter team member details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="num-members">Number of Team Members</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNumTeamMembersChange(Math.max(1, numTeamMembers - 1))}
                        disabled={numTeamMembers <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={numTeamMembers}
                        onChange={(e) => handleNumTeamMembersChange(parseInt(e.target.value) || 1)}
                        className="w-20 text-center"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNumTeamMembersChange(Math.min(10, numTeamMembers + 1))}
                        disabled={numTeamMembers >= 10}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {teamMembers.map((member, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium">Team Member {index + 1}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`name-${index}`}>Name</Label>
                          <Input
                            id={`name-${index}`}
                            placeholder="Enter name"
                            value={member.name}
                            onChange={(e) => handleTeamMemberChange(index, 'name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`usn-${index}`}>USN</Label>
                          <Input
                            id={`usn-${index}`}
                            placeholder="Enter USN"
                            value={member.usn}
                            onChange={(e) => handleTeamMemberChange(index, 'usn', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Teachers</CardTitle>
                <CardDescription>
                  Select guide information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="guide">Guide Name</Label>
                    <Select
                      value={selectedTeacherId}
                      onValueChange={(value) => {
                        setSelectedTeacherId(value)
                        const selected = teachers.find((teacher) => teacher.id === value)
                        setGuideName(selected?.name || '')
                        setSelectedTeacherDesignation(selected?.designation || '')
                        setGuideDepartment(resolveDepartmentLabel(selected?.departmentId || ''))
                      }}
                    >
                      <SelectTrigger id="guide" className="mt-1">
                        <SelectValue placeholder={teachersLoading ? 'Loading teachers...' : 'Select guide'} />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name} {teacher.designation ? `(${teacher.designation})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="guide-designation">Guide Designation</Label>
                    <Input
                      id="guide-designation"
                      className="mt-1"
                      value={selectedTeacherDesignation}
                    />
                  </div>

                  <div>
                    <Label htmlFor="guide-department">Guide Department</Label>
                    <Input
                      id="guide-department"
                      className="mt-1"
                      value={guideDepartment}
                      onChange={(e) => setGuideDepartment(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">HOD Details</CardTitle>
                <CardDescription>
                  Confirm HOD information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="hod-name">HOD Name</Label>
                    <Input
                      id="hod-name"
                      className="mt-1"
                      value={hodName}
                      onChange={(e) => setHodName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="hod-designation">HOD Designation</Label>
                    <Input
                      id="hod-designation"
                      className="mt-1"
                      value={hodDesignation}
                      onChange={(e) => setHodDesignation(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="hod-department">HOD Department</Label>
                    <Input
                      id="hod-department"
                      className="mt-1"
                      value={hodDepartment}
                      onChange={(e) => setHodDepartment(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Subject Details</CardTitle>
                <CardDescription>
                  Enter subject details manually
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="subject-code">Subject Code</Label>
                    <Input
                      value={subjectCode}
                      id="subject-code"
                      className="mt-1"
                      placeholder="Enter subject code"
                      onChange={(e) => setSubjectCode(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="subject-name">Subject Name</Label>
                    <Input
                      id="subject-name"
                      className="mt-1"
                      value={subjectName}
                      placeholder="Enter subject name"
                      onChange={(e) => setSubjectName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="semester">Semester</Label>
                    <Input
                      id="semester"
                      className="mt-1"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Principal Details</CardTitle>
                <CardDescription>
                  Enter principal information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="principal-name">Principal Name</Label>
                    <Input
                      id="principal-name"
                      className="mt-1"
                      value={principalName}
                      readOnly
                    />
                  </div>

                  <div>
                    <Label htmlFor="principal-designation-1">Principal Designation 1</Label>
                    <Input
                      id="principal-designation-1"
                      className="mt-1"
                      value={principalDesignation1}
                      readOnly
                    />
                  </div>

                  <div>
                    <Label htmlFor="principal-designation-2">Principal Designation 2</Label>
                    <Input
                      id="principal-designation-2"
                      className="mt-1"
                      value={principalDesignation2}
                      readOnly
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Abstract</CardTitle>
                <CardDescription>
                  Add the abstract content for the report front page
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="abstract-content">Abstract Content</Label>
                    <Textarea
                      id="abstract-content"
                      className="mt-1 min-h-[120px]"
                      value={abstractContent}
                      onChange={(e) => setAbstractContent(e.target.value)}
                      placeholder="Enter abstract text"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {isProcessing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Processing Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${processingStatus.progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{processingStatus.progress}%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">{processingStatus.stage}:</span> {processingStatus.message}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {extractedChapters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extracted Chapters</CardTitle>
                  <CardDescription>
                    {extractedChapters.length} chapters found and processed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {extractedChapters.map((chapter, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">Chapter {index + 1}: {chapter.title}</span>
                        <Badge variant="outline">{chapter.images.length} images</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report Validation</CardTitle>
                <CardDescription>
                  Run quality checks for captions, references, spelling, and grammar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleValidate}
                  disabled={validationLoading || !sourceDocument}
                  variant="outline"
                  className="w-full"
                >
                  {validationLoading ? 'Validating...' : 'Validate Report'}
                </Button>

                {validationError && (
                  <div className="text-sm text-destructive">{validationError}</div>
                )}

                {validationSummary && (
                  <div className="text-sm text-muted-foreground">
                    {validationSummary.critical} critical · {validationSummary.warnings} warnings ·
                    {` ${validationSummary.images} images, ${validationSummary.figureCaptions} figure captions, ${validationSummary.tableCaptions} table captions`}
                  </div>
                )}

                {validationIssues.length > 0 && (
                  <div className="space-y-2">
                    {validationIssues.map((issue, index) => (
                      <div key={index} className="flex items-start gap-3 rounded border p-3">
                        <Badge
                          className={
                            issue.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }
                        >
                          {issue.severity.toUpperCase()}
                        </Badge>
                        <div className="space-y-2 flex-1">
                          <p className="text-sm font-medium">{issue.label}</p>
                          <p className="text-sm text-muted-foreground">{issue.message}</p>
                          {issue.location && (
                            <div className="text-xs bg-gray-100 p-2 rounded italic">
                              <span className="font-semibold">Location:</span> "{issue.location}"
                            </div>
                          )}
                          {issue.example && (
                            <div className="text-xs bg-red-50 p-2 rounded font-mono border-l-2 border-red-300">
                              <span className="font-semibold">Found:</span> <span className="text-red-700">{issue.example}</span>
                            </div>
                          )}
                          {issue.correction && (
                            <div className="text-xs bg-green-50 p-2 rounded font-mono border-l-2 border-green-300">
                              <span className="font-semibold">Change to:</span> <span className="text-green-700">{issue.correction}</span>
                            </div>
                          )}
                          {issue.suggestion && (
                            <p className="text-xs text-muted-foreground">💡 {issue.suggestion}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {validationIssues.length === 0 && validationSummary && !validationLoading && !validationError && (
                  <div className="text-sm text-muted-foreground">No issues detected.</div>
                )}
              </CardContent>
            </Card>

            <Button 
              onClick={handleProcess} 
              disabled={isProcessing || !sourceDocument || !projectTitle || !guideName || !subjectCode || !subjectName || !year}
              className="w-full bg-gradient-primary hover:bg-academic-blue-dark"
            >
              {isProcessing ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  Processing Document...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Process Document with AI
                </>
              )}
            </Button>
          </div>

          {/* Preview Section */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center">
                  <Eye className="mr-2 h-5 w-5" />
                  Report Preview
                </div>
                <div className="flex items-center gap-2">
                  {previewPdfBase64 && previewPdfName && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadBase64File(previewPdfName, previewPdfBase64, 'application/pdf')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  )}
                  {wordDownloadBase64 && wordDownloadName && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadBase64File(wordDownloadName, wordDownloadBase64, getWordMimeType(wordDownloadName))}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Word
                    </Button>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                Preview the generated PDF and download outputs
              </CardDescription>
            </CardHeader>
            <CardContent className="h-full overflow-hidden">
              {previewPdfUrl ? (
                <div className="h-full flex flex-col gap-4">
                  <div className="flex-1 border rounded-lg overflow-hidden">
                    <iframe
                      title="Report Preview"
                      src={previewPdfUrl}
                      className="w-full h-full"
                    />
                  </div>
                  {processingStatus.stage === 'complete' && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <span className="text-green-800 font-medium">Processing Complete!</span>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        Your report PDF is ready for preview and download.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Files Generated</h3>
                    <p className="text-muted-foreground">
                      Upload your source document, then click "Process Document with AI"
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}