import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  ArrowLeft,
  Search,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Activity,
  BookOpen
} from 'lucide-react'
import { findResearchGaps, ResearchGap, GapAnalysisResult } from '@/services/researchGapService'
import { testGroqConnection } from '@/services/groqService'
import { Paper } from '@/services/openAlexService'
import { toast } from '@/hooks/use-toast'

interface ResearchGapAnalysisProps {
  paper: Paper | null
  onClose?: () => void
}

export function ResearchGapAnalysis({ paper, onClose }: ResearchGapAnalysisProps) {
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const testGroqAIConnection = async () => {
    try {
      setDebugInfo(['Testing Groq AI connection...'])
      
      const isWorking = await testGroqConnection()
      
      if (isWorking) {
        setDebugInfo(prev => [...prev, `✅ Groq AI connection successful!`, `Groq API is responding correctly`])
        
        toast({
          title: "Groq AI Test Successful",
          description: "Groq AI is connected and responding correctly.",
        })
      } else {
        throw new Error('Groq AI test failed')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setDebugInfo(prev => [...prev, `❌ Groq AI test failed: ${errorMsg}`])
      
      toast({
        title: "Groq AI Test Failed",
        description: "Please ensure you have set the VITE_GROQ_API_KEY environment variable.",
        variant: "destructive",
      })
    }
  }

  const analyzeResearchGaps = async () => {
    if (!paper) return

    setLoading(true)
    setError(null)
    setGapAnalysis(null)
    setDebugInfo([])

    try {
      setDebugInfo(prev => [...prev, 'Starting research gap analysis...'])
      
      const result = await findResearchGaps(paper)
      
      setDebugInfo(prev => [...prev, `Analysis complete! Found ${result.gaps.length} gaps from ${result.totalRelatedPapers} papers`])
      setGapAnalysis(result)
      
      toast({
        title: "Research Gap Analysis Complete",
        description: `Found ${result.gaps.length} potential research opportunities.`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze research gaps'
      setDebugInfo(prev => [...prev, `Error: ${errorMessage}`])
      setError(errorMessage)
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!paper) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Paper Selected</h3>
        <p className="text-muted-foreground">Please select a paper to analyze research gaps.</p>
      </div>
    )
  }

  return (
  <div className="flex flex-col h-[120vh]">
      <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Search className="h-6 w-6 text-blue-500" />
              Research Gap Analysis
            </h1>
            <p className="text-muted-foreground">
              Discover research opportunities for: {paper.title}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={testGroqAIConnection}
            size="sm"
          >
            <Activity className="h-4 w-4 mr-2" />
            Test Groq AI
          </Button>
          <Button 
            onClick={analyzeResearchGaps}
            disabled={loading}
            size="sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Analyze Gaps
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="analysis" className="h-full flex flex-col">
          <div className="px-6 pt-4 flex-shrink-0">
            <TabsList>
              <TabsTrigger value="analysis">Gap Analysis</TabsTrigger>
              <TabsTrigger value="debug">Debug Info</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analysis" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full px-6 pb-6">
                <div className="mt-4 space-y-4">
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                        <h3 className="font-medium mb-2">Analyzing Research Gaps</h3>
                        <p className="text-sm text-muted-foreground">
                          Fetching related papers and analyzing with Groq AI...
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-red-800 mb-2">
                          <AlertCircle className="h-5 w-5" />
                          <h3 className="font-medium">Analysis Failed</h3>
                        </div>
                        <p className="text-red-700">{error}</p>
                      </CardContent>
                    </Card>
                  )}

                  {gapAnalysis && gapAnalysis.gaps.length > 0 && (
                    <>
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2 text-yellow-800">
                          <Lightbulb className="h-6 w-6 text-yellow-600" />
                          Found {gapAnalysis.gaps.length} Research Gaps
                        </h2>
                        <p className="text-sm text-yellow-700 mt-1">
                          Research opportunities identified by AI analysis
                        </p>
                      </div>
                      
                      <div className="space-y-4">
                      {gapAnalysis.gaps.map((gap, index) => (
                        <Card key={index} className="border-2 hover:border-blue-200 transition-colors">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-start gap-2 flex-wrap">
                              <div className="flex gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {gap.category}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {Math.round(gap.confidence * 100)}% Confidence
                                </Badge>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                                {gap.title}
                              </h3>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium text-sm text-gray-700 mb-1">Description:</h4>
                                <p className="text-sm text-gray-600 leading-relaxed">{gap.description}</p>
                              </div>
                              {gap.justification && (
                                <div>
                                  <h4 className="font-medium text-sm text-gray-700 mb-1">Justification:</h4>
                                  <div className="text-sm text-blue-700 bg-blue-50 border-l-4 border-blue-300 pl-3 py-2 rounded-r">
                                    {gap.justification}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <div className="text-center py-4 text-sm text-gray-500">
                      End of research gaps analysis • {gapAnalysis.gaps.length} opportunities found
                    </div>
                  </>
                )}

                {!loading && !error && !gapAnalysis && (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
                    <p className="text-muted-foreground mb-4">
                      Click "Analyze Gaps" to discover research opportunities.
                    </p>
                    <Button onClick={analyzeResearchGaps}>
                      <Search className="h-4 w-4 mr-2" />
                      Start Analysis
                    </Button>
                  </div>
                )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="debug" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full px-6 pb-6">
                <div className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Debug Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 font-mono text-sm">
                        {debugInfo.length === 0 ? (
                          <p className="text-muted-foreground">No debug information yet...</p>
                        ) : (
                          debugInfo.map((info, index) => (
                            <div key={index} className="p-2 bg-gray-50 rounded">
                              {info}
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
