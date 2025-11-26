import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Download, Eye, Sparkles, Plus, Minus, CheckCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

export function AIReportFormatter() {
  const [sourceDocument, setSourceDocument] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({ stage: '', progress: 0, message: '' })
  const [extractedChapters, setExtractedChapters] = useState<Chapter[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<{ [filename: string]: string }>({})
  const [mainLatexFile, setMainLatexFile] = useState("")
  
  // Team and project details
  const [numTeamMembers, setNumTeamMembers] = useState<number>(1)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([{ name: "", usn: "" }])
  const [guideName, setGuideName] = useState("")
  const [year, setYear] = useState("")
  const [projectTitle, setProjectTitle] = useState("")

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

  const processDocumentWithBackend = async (file: File, projectDetails: { title: string, guide: string, year: string, teamMembers: TeamMember[] }): Promise<{ chapters: Chapter[], files: { [filename: string]: string } }> => {
    try {
      updateProcessingStatus('uploading', 25, 'Uploading document to backend...')
      
      // Prepare form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('project_title', projectDetails.title)
      formData.append('guide_name', projectDetails.guide)
      formData.append('year', projectDetails.year)
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
        files: result.files
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

    if (!projectTitle || !guideName || !year || teamMembers.some(member => !member.name || !member.usn)) {
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
        year: year,
        teamMembers: teamMembers
      }
      
      // Process with backend
      const { chapters, files } = await processDocumentWithBackend(sourceDocument, projectDetails)
      
      setExtractedChapters(chapters)
      setMainLatexFile(files['report.tex'] || '')
      setGeneratedFiles(files)
      
      updateProcessingStatus('complete', 100, `Successfully processed ${chapters.length} chapters`)
      
    } catch (error) {
      console.error('Processing error:', error)
      updateProcessingStatus('error', 0, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = (e) => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadAllFiles = () => {
    Object.entries(generatedFiles).forEach(([filename, content]) => {
      setTimeout(() => downloadFile(filename, content), 100)
    })
  }



  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-academic-navy mb-2">Automated Document Processor</h2>
          <p className="text-academic-gray">
            Convert Word documents to LaTeX using AI - Upload source document (.doc/.docx) and template (.tex)
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
                    <Label htmlFor="guide">Guide Name</Label>
                    <Input
                      id="guide"
                      placeholder="Enter guide name"
                      className="mt-1"
                      value={guideName}
                      onChange={(e) => setGuideName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      placeholder="Enter year (e.g., 2024)"
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

            <Button 
              onClick={handleProcess} 
              disabled={isProcessing || !sourceDocument || !projectTitle || !guideName || !year}
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
                  Generated Files
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={downloadAllFiles}
                  disabled={Object.keys(generatedFiles).length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              </CardTitle>
              <CardDescription>
                Generated LaTeX project files
              </CardDescription>
            </CardHeader>
            <CardContent className="h-full overflow-hidden">
              {Object.keys(generatedFiles).length > 0 ? (
                <Tabs defaultValue="report.tex" className="h-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="report.tex">Main File</TabsTrigger>
                    <TabsTrigger value="chapters">Chapters</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="report.tex" className="h-full overflow-y-auto mt-4">
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">report.tex</span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => downloadFile('report.tex', mainLatexFile)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                      <code className="whitespace-pre-wrap">
                        {mainLatexFile}
                      </code>
                    </pre>
                  </TabsContent>
                  
                  <TabsContent value="chapters" className="h-full overflow-y-auto mt-4">
                    <div className="space-y-4">
                      {Object.entries(generatedFiles)
                        .filter(([filename]) => filename.startsWith('chapter'))
                        .map(([filename, content]) => (
                          <div key={filename} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{filename}</span>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => downloadFile(filename, content)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            </div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                              <code className="whitespace-pre-wrap">
                                {content.substring(0, 500)}...
                              </code>
                            </pre>
                          </div>
                        ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="summary" className="h-full overflow-y-auto mt-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {extractedChapters.length}
                          </div>
                          <div className="text-sm text-blue-800">Chapters</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {Object.keys(generatedFiles).length}
                          </div>
                          <div className="text-sm text-green-800">Files Generated</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium">Generated Files:</h4>
                        {Object.keys(generatedFiles).map((filename) => (
                          <div key={filename} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">{filename}</span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => downloadFile(filename, generatedFiles[filename])}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      {processingStatus.stage === 'complete' && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center">
                            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                            <span className="text-green-800 font-medium">Processing Complete!</span>
                          </div>
                          <p className="text-sm text-green-700 mt-1">
                            Your LaTeX project is ready. Download all files and compile with your LaTeX editor.
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Files Generated</h3>
                    <p className="text-muted-foreground">
                      Upload your source document and template, then click "Process Document with AI"
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