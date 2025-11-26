import { useState, useCallback, useEffect } from "react"
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Position,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Eye, ChevronDown, ChevronRight, Loader2, ExternalLink } from "lucide-react"
import { searchPapers, Paper, checkBackendHealth } from "@/services/openAlexService"
import { getClusterTree, ClusterResponse } from "@/services/paperClusteringService"
import { toast } from "@/hooks/use-toast"

// Tree structure for departments and topics
const treeStructure = {
  "Computer Science": {
    "Artificial Intelligence": ["machine learning", "deep learning", "neural networks"],
    "Software Engineering": ["web development", "mobile applications", "software architecture"],
    "Data Science": ["data mining", "big data analytics", "statistical analysis"]
  },
  "ECE": {
    "Signal Processing": ["digital signal processing", "image processing", "audio processing"],
    "Communications": ["wireless networks", "5G technology", "satellite communication"],
    "Embedded Systems": ["internet of things", "microcontrollers", "real-time systems"]
  },
  "EEE": {
    "Power Systems": ["renewable energy", "smart grid", "power electronics"],
    "Control Systems": ["automation", "process control", "robotics control"],
    "Electronics": ["VLSI design", "analog circuits", "digital electronics"]
  },
  "Mechanical": {
    "Thermodynamics": ["heat transfer", "energy systems", "HVAC systems"],
    "Manufacturing": ["3D printing", "CNC machining", "quality control"],
    "Fluid Mechanics": ["aerodynamics", "hydraulics", "computational fluid dynamics"]
  },
  "Civil": {
    "Structural Engineering": ["earthquake engineering", "bridge design", "structural analysis"],
    "Environmental": ["water treatment", "air quality monitoring", "waste management"],
    "Transportation": ["traffic engineering", "urban planning", "highway design"]
  }
}

interface TreeNodeProps {
  name: string
  level: number
  isExpanded: boolean
  onToggle: () => void
  onLeafClick?: (name: string) => void
  children?: React.ReactNode
}

function TreeNode({ name, level, isExpanded, onToggle, onLeafClick, children }: TreeNodeProps) {
  const hasChildren = children !== undefined
  const indentLevel = level * 20

  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-2 px-3 hover:bg-accent rounded-lg cursor-pointer transition-colors`}
        style={{ paddingLeft: `${indentLevel + 12}px` }}
        onClick={hasChildren ? onToggle : () => onLeafClick?.(name)}
      >
        {hasChildren && (
          <div className="mr-2 w-4 h-4 flex items-center justify-center">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        )}
        <span className={`text-sm ${hasChildren ? 'font-medium' : ''} ${level === 0 ? 'text-academic-navy font-bold' : level === 1 ? 'text-academic-blue' : 'text-academic-gray'}`}>
          {name}
        </span>
        {!hasChildren && (
          <BookOpen size={14} className="ml-2 text-academic-gray" />
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-4">
          {children}
        </div>
      )}
    </div>
  )
}

export function ResearchHub() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  // Check backend health on component mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await checkBackendHealth()
        setBackendStatus('online')
      } catch (error) {
        console.error('Backend health check failed:', error)
        setBackendStatus('offline')
        toast({
          title: "Backend Offline",
          description: "Unable to connect to the research backend. Some features may not work.",
          variant: "destructive",
        })
      }
    }
    
    checkBackend()
  }, [])

  const toggleNode = (nodeName: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeName)) {
      newExpanded.delete(nodeName)
    } else {
      newExpanded.add(nodeName)
    }
    setExpandedNodes(newExpanded)
  }

  const handleLeafClick = async (topicName: string) => {
    setSelectedTopic(topicName)
    setLoading(true)
    setPapers([])

    try {
      // Search for papers related to the selected topic
      const result = await searchPapers(topicName, 20, 2015, 2024)
      setPapers(result.papers)
      
      toast({
        title: "Papers Loaded",
        description: `Found ${result.papers.length} papers for "${topicName}"`,
      })
    } catch (error) {
      console.error('Error fetching papers:', error)
      toast({
        title: "Error Loading Papers",
        description: "Failed to fetch papers. Please check your backend connection.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const openPaperUrl = (url: string) => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  const renderTree = () => {
    return Object.entries(treeStructure).map(([department, topics]) => (
      <TreeNode
        key={department}
        name={department}
        level={0}
        isExpanded={expandedNodes.has(department)}
        onToggle={() => toggleNode(department)}
      >
        {Object.entries(topics).map(([category, subtopics]) => (
          <TreeNode
            key={category}
            name={category}
            level={1}
            isExpanded={expandedNodes.has(category)}
            onToggle={() => toggleNode(category)}
          >
            {subtopics.map((subtopic) => (
              <TreeNode
                key={subtopic}
                name={subtopic}
                level={2}
                isExpanded={false}
                onToggle={() => {}}
                onLeafClick={handleLeafClick}
              />
            ))}
          </TreeNode>
        ))}
      </TreeNode>
    ))
  }

  return (
    <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-academic-navy mb-2">Research Hub</h2>
              <p className="text-academic-gray">
                Explore research topics across departments and discover relevant papers
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                backendStatus === 'online' ? 'bg-green-500' : 
                backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              <span className="text-sm text-muted-foreground">
                Backend {backendStatus === 'checking' ? 'Checking...' : backendStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Tree Structure */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Research Areas</CardTitle>
                <CardDescription>
                  Click to expand departments and select research topics
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto h-full">
                {renderTree()}
              </CardContent>
            </Card>
          </div>

          {/* Research Papers */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedTopic ? `Research Papers - ${selectedTopic}` : "Select a Research Topic"}
                  {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin inline" />}
                </CardTitle>
                <CardDescription>
                  {selectedTopic 
                    ? `Browse relevant research papers from OpenAlex ${papers.length > 0 ? `(${papers.length} found)` : ''}`
                    : "Choose a topic from the research tree to view related papers"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto h-full">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-academic-blue" />
                      <p className="text-academic-gray">Loading papers...</p>
                    </div>
                  </div>
                ) : selectedTopic && papers.length > 0 ? (
                  <div className="space-y-4">
                    {papers.map((paper) => (
                      <Card key={paper.id} className="border border-border hover:shadow-card transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-academic-navy leading-tight cursor-pointer hover:text-academic-blue transition-colors"
                                onClick={() => openPaperUrl(paper.url || paper.doi || '')}>
                              {paper.title}
                              {(paper.url || paper.doi) && <ExternalLink className="inline ml-1 h-3 w-3" />}
                            </h3>
                            <div className="flex space-x-2 ml-2">
                              <Badge variant="secondary">
                                {paper.year}
                              </Badge>
                              <Badge variant="outline">
                                {paper.citation_count} citations
                              </Badge>
                            </div>
                          </div>
                          {paper.abstract && (
                            <p className="text-sm text-academic-gray mb-3 leading-relaxed line-clamp-3">
                              {paper.abstract}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Authors: {paper.authors.length > 0 
                                ? paper.authors.slice(0, 3).map(a => a.name).join(", ") + 
                                  (paper.authors.length > 3 ? ` +${paper.authors.length - 3} more` : '')
                                : 'Unknown'}
                            </div>
                            <div className="flex space-x-2">
                              {paper.venue && (
                                <Badge variant="outline" className="text-xs">
                                  {paper.venue}
                                </Badge>
                              )}
                              {(paper.url || paper.doi) && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openPaperUrl(paper.url || paper.doi || '')}
                                >
                                  <ExternalLink className="mr-1 h-3 w-3" />
                                  View Paper
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : selectedTopic && papers.length === 0 && !loading ? (
                  <div className="flex items-center justify-center h-64 text-academic-gray">
                    <div className="text-center">
                      <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No papers found for "{selectedTopic}"</p>
                      <p className="text-sm mt-2">Try a different research topic or check your backend connection</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-academic-gray">
                    <div className="text-center">
                      <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Select a research topic to view related papers</p>
                      <p className="text-sm mt-2">Papers will be fetched from OpenAlex in real-time</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}