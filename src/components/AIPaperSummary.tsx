// AI-powered paper summary component using Gemini
import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Brain, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Lightbulb, 
  Target, 
  Zap,
  TrendingUp,
  FileText,
  ExternalLink 
} from 'lucide-react'
import { summarizePaper, PaperSummary } from '@/services/geminiService'
import { Paper } from '@/services/openAlexService'
import { toast } from '@/hooks/use-toast'

interface AIPaperSummaryProps {
  paper: Paper | null
  onClose?: () => void
}

export function AIPaperSummary({ paper, onClose }: AIPaperSummaryProps) {
  const [summary, setSummary] = useState<PaperSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSummary = async () => {
    if (!paper) return

    setLoading(true)
    setError(null)
    setSummary(null)

    try {
      const result = await summarizePaper(paper)
      setSummary(result)
      
      toast({
        title: "AI Summary Generated",
        description: "Paper has been analyzed successfully by Gemini AI.",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate summary'
      setError(errorMessage)
      
      toast({
        title: "Summary Generation Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!paper) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Brain className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Select a paper to generate AI summary</p>
        </div>
      </div>
    )
  }

  const openPaperUrl = () => {
    if (paper.url || paper.doi) {
      window.open(paper.url || paper.doi || '', '_blank')
    }
  }

  return (
  <div className="h-[120vh] max-h-none overflow-hidden flex flex-col">
      {/* Header with action buttons */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex gap-2">
          <Button 
            onClick={generateSummary} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            {loading ? 'Generating AI Summary...' : 'Generate AI Summary'}
          </Button>
        </div>
      </div>

      {/* Content area with proper scrolling */}
      <div className="flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full w-full">
          <div className="p-4 pr-8">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Summary Generation Failed</span>
                </div>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <Brain className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
                  <p className="text-lg font-medium">AI is analyzing the paper...</p>
                  <p className="text-sm text-muted-foreground">This may take a few moments</p>
                </div>
              </div>
            )}

            {summary && (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                  <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-primary">Executive Summary</h3>
                    </div>
                    <p className="text-sm leading-relaxed">{summary.overview}</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-500" />
                      Key Findings
                    </h3>
                    <div className="space-y-2">
                      {summary.keyFindings.map((finding, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="technical" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      Techniques & Methods
                    </h3>
                    <div className="grid gap-2">
                      {summary.techniques.map((technique, index) => (
                        <Badge key={index} variant="secondary" className="justify-start p-2 h-auto">
                          {technique}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-semibold">Methodology</h3>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm leading-relaxed">{summary.methodology}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="evaluation" className="space-y-4 mt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Advantages
                      </h3>
                      <div className="space-y-2">
                        {summary.advantages.map((advantage, index) => (
                          <div key={index} className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <span className="text-sm">{advantage}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-orange-600">
                        <AlertCircle className="h-4 w-4" />
                        Limitations
                      </h3>
                      <div className="space-y-2">
                        {summary.limitations.map((limitation, index) => (
                          <div key={index} className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <span className="text-sm">{limitation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="insights" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      Future Research Directions
                    </h3>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm leading-relaxed">{summary.futureWork}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      AI Analysis Insights
                    </h3>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm leading-relaxed">
                        This paper contributes to the field by introducing {summary.techniques.length > 0 ? summary.techniques[0].toLowerCase() : 'novel approaches'} 
                        {summary.advantages.length > 0 && `, with key advantages including ${summary.advantages[0].toLowerCase()}`}.
                        {summary.limitations.length > 0 && ` However, limitations such as ${summary.limitations[0].toLowerCase()} should be considered for future implementations.`}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {!summary && !loading && !error && (
              <div className="text-center py-12 text-muted-foreground">
                <Brain className="mx-auto h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">AI-Powered Paper Analysis</p>
                <p className="text-sm mb-4 max-w-md mx-auto">
                  Get comprehensive insights including techniques used, advantages, limitations, and future research directions.
                </p>
                <Button onClick={generateSummary} variant="outline">
                  <Brain className="mr-2 h-4 w-4" />
                  Start AI Analysis
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
