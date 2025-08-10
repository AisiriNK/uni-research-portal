import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Download, Eye, Sparkles } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function AIReportFormatter() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [content, setContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    // Simulate AI processing
    setTimeout(() => {
      setIsGenerating(false)
    }, 2000)
  }

  const sampleFormattedContent = `# Research Report: AI in Healthcare

## Executive Summary
This report presents a comprehensive analysis of artificial intelligence applications in healthcare, focusing on diagnostic systems, treatment optimization, and patient care enhancement.

## 1. Introduction
The integration of artificial intelligence (AI) in healthcare represents one of the most significant technological advances of the 21st century. This report examines current applications, challenges, and future prospects.

### 1.1 Background
Healthcare systems worldwide face increasing pressure to improve efficiency while maintaining quality care...

### 1.2 Objectives
- Analyze current AI implementations in healthcare
- Identify key challenges and opportunities
- Propose recommendations for future development

## 2. Methodology
Our research methodology encompasses both quantitative and qualitative approaches:

1. **Literature Review**: Comprehensive analysis of 150+ peer-reviewed papers
2. **Case Studies**: Examination of 20 healthcare institutions
3. **Expert Interviews**: Discussions with 15 industry professionals

## 3. Findings

### 3.1 Diagnostic AI Systems
Current diagnostic AI systems demonstrate remarkable accuracy:
- **Radiology**: 95% accuracy in cancer detection
- **Pathology**: 92% accuracy in tissue analysis
- **Cardiology**: 88% accuracy in heart condition diagnosis

### 3.2 Treatment Optimization
AI-driven treatment recommendations show promising results:
- Personalized treatment plans
- Drug discovery acceleration
- Clinical trial optimization

## 4. Challenges and Limitations
Despite significant progress, several challenges remain:

- **Data Privacy**: Patient confidentiality concerns
- **Regulatory Compliance**: Complex approval processes  
- **Integration Issues**: Legacy system compatibility

## 5. Recommendations
Based on our analysis, we recommend:

1. **Enhanced Data Governance**: Implement robust privacy frameworks
2. **Standardization**: Develop industry-wide standards
3. **Training Programs**: Invest in healthcare professional education

## 6. Conclusion
AI in healthcare presents unprecedented opportunities for improving patient outcomes while addressing systemic challenges. Success requires coordinated efforts across technology, policy, and healthcare domains.

---
*Report generated using AI Report Formatter v2.1*`

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-academic-navy mb-2">AI Report Formatter</h2>
          <p className="text-academic-gray">
            Upload templates and generate professionally formatted research reports
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Upload className="mr-2 h-5 w-5" />
                  Template Upload
                </CardTitle>
                <CardDescription>
                  Upload a report template (.txt, .md, .docx)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template">Report Template</Label>
                    <Input
                      id="template"
                      type="file"
                      accept=".txt,.md,.docx"
                      onChange={handleFileUpload}
                      className="mt-1"
                    />
                    {uploadedFile && (
                      <div className="mt-2 flex items-center space-x-2">
                        <FileText size={16} className="text-academic-blue" />
                        <span className="text-sm text-academic-gray">
                          {uploadedFile.name}
                        </span>
                        <Badge variant="secondary">Uploaded</Badge>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="title">Report Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter your report title"
                      className="mt-1"
                      defaultValue="AI in Healthcare: Current State and Future Prospects"
                    />
                  </div>

                  <div>
                    <Label htmlFor="author">Author(s)</Label>
                    <Input
                      id="author"
                      placeholder="Enter author names"
                      className="mt-1"
                      defaultValue="John Doe, Jane Smith"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Content Input</CardTitle>
                <CardDescription>
                  Paste or type your report content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Paste your research content here. The AI will format it according to your template..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[200px] resize-none"
                  defaultValue="This research explores the current applications of artificial intelligence in healthcare systems, examining diagnostic tools, treatment optimization, and patient care improvements. The study analyzes 150 recent publications, conducts interviews with healthcare professionals, and evaluates 20 case studies from leading medical institutions. Key findings indicate significant improvements in diagnostic accuracy, with AI systems achieving 95% accuracy in cancer detection and 92% in pathology analysis. However, challenges remain in data privacy, regulatory compliance, and system integration. The report concludes with recommendations for enhanced data governance, industry standardization, and comprehensive training programs for healthcare professionals."
                />
              </CardContent>
            </Card>

            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="w-full bg-gradient-primary hover:bg-academic-blue-dark"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Formatted Report
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
                  Formatted Preview
                </div>
                <Button size="sm" variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </CardTitle>
              <CardDescription>
                Live preview of your formatted report
              </CardDescription>
            </CardHeader>
            <CardContent className="h-full overflow-hidden">
              <Tabs defaultValue="preview" className="h-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="markdown">Markdown</TabsTrigger>
                </TabsList>
                
                <TabsContent value="preview" className="h-full overflow-y-auto mt-4">
                  <div className="prose prose-sm max-w-none">
                    <div 
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: sampleFormattedContent
                          .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold text-academic-navy mb-4 pb-2 border-b">$1</h1>')
                          .replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold text-academic-navy mt-6 mb-3">$1</h2>')
                          .replace(/^### (.*$)/gm, '<h3 class="text-base font-medium text-academic-blue mt-4 mb-2">$1</h3>')
                          .replace(/^\*\*(.*?)\*\*/gm, '<strong class="font-semibold text-academic-navy">$1</strong>')
                          .replace(/^- (.*$)/gm, '<li class="ml-4 text-academic-gray">$1</li>')
                          .replace(/^\d+\. (.*$)/gm, '<li class="ml-4 text-academic-gray list-decimal">$1</li>')
                          .replace(/\n/g, '<br/>')
                      }}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="markdown" className="h-full overflow-y-auto mt-4">
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                    <code>{sampleFormattedContent}</code>
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}