import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Loader2, Network, ExternalLink, Folder, FileText, PieChart, AlertTriangle, Zap } from "lucide-react"
import { getClusterTree, ClusterResponse, ClusterNode, ClusterEdge } from "@/services/paperClusteringService"
import { Paper } from "@/services/openAlexService"
import { toast } from "@/hooks/use-toast"
import { HierarchicalTree } from "@/components/HierarchicalTree"
import { PaperDensityView } from "@/components/PaperDensityView"
import { AIPaperSummary } from "@/components/AIPaperSummary"
import { ResearchGapAnalysis } from "@/components/ResearchGapAnalysis"

import { MOCK_CLUSTER_DATA } from "@/services/mockData"

export function PaperSearchCluster() {
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [clusterData, setClusterData] = useState<ClusterResponse | null>(null)
  const [selectedNode, setSelectedNode] = useState<ClusterNode | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())

  const [useMockData, setUseMockData] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Enter a search query",
        description: "Please enter a research topic to search for papers.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setClusterData(null)
    setSelectedNode(null)
    setBackendError(null)

    try {
      console.log('Fetching cluster data for:', searchQuery);
      const result = await getClusterTree(searchQuery, 50)
      console.log('Cluster data received:', result);
      
      if (!result || !result.nodes || !result.edges || result.nodes.length === 0) {
        throw new Error('Received empty or invalid cluster data');
      }
      
      setClusterData(result)
      setUseMockData(false)
      
      // Auto-expand root nodes
      const rootNodes = result.nodes.filter(node => node.level === 0)
      console.log('Root nodes:', rootNodes);
      setExpandedClusters(new Set(rootNodes.map(node => node.id)))
      
      toast({
        title: "Clustering Complete",
        description: `Generated ${result.nodes.length} clusters with ${result.edges.length} connections.`,
      })
    } catch (error) {
      console.error('Error clustering papers:', error);
      
      // Set specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setBackendError(errorMessage);
      
      toast({
        title: "Clustering Failed",
        description: "Failed to cluster papers. Using mock data for testing.",
        variant: "destructive",
      })
      
      // Use mock data as fallback for development/testing
      console.log('Using mock data as fallback');
      setClusterData(MOCK_CLUSTER_DATA as unknown as ClusterResponse);
      setUseMockData(true);
      
      // Auto-expand root nodes from mock data
      const rootNodes = MOCK_CLUSTER_DATA.nodes.filter(node => node.level === 0);
      setExpandedClusters(new Set(rootNodes.map(node => node.id)));
    } finally {
      setLoading(false)
    }
  }

  const toggleCluster = (clusterId: string) => {
    const newExpanded = new Set(expandedClusters)
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId)
    } else {
      newExpanded.add(clusterId)
    }
    setExpandedClusters(newExpanded)
  }

  const getChildNodes = (parentId: string): ClusterNode[] => {
    if (!clusterData) return []
    return clusterData.nodes.filter(node => node.parent_id === parentId)
  }

  const getRootNodes = (): ClusterNode[] => {
    if (!clusterData) return []
    return clusterData.nodes.filter(node => node.level === 0)
  }

  const openPaperUrl = (url: string) => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  const renderClusterNode = (node: ClusterNode, level: number = 0): React.ReactNode => {
    const hasChildren = getChildNodes(node.id).length > 0
    const isExpanded = expandedClusters.has(node.id)
    const indentLevel = level * 20

    return (
      <div key={node.id} className="mb-2">
        <div 
          className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors hover:bg-accent ${
            selectedNode?.id === node.id ? 'bg-accent border-l-4 border-primary' : ''
          }`}
          style={{ paddingLeft: `${indentLevel + 12}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleCluster(node.id)
            } else {
              setSelectedNode(node)
            }
          }}
        >
          {hasChildren ? (
            <Folder className={`mr-2 h-4 w-4 ${isExpanded ? 'text-primary' : 'text-muted-foreground'}`} />
          ) : (
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
          )}
          <span className={`flex-1 text-sm font-medium ${level === 0 ? 'text-primary font-bold' : ''}`}>
            {node.label}
          </span>
          <Badge variant="outline" className="text-xs">
            {node.paper_count} papers
          </Badge>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {getChildNodes(node.id).map(childNode => renderClusterNode(childNode, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
  <div className="h-full bg-background">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-primary mb-2">Paper Search & Clustering</h2>
          <p className="text-muted-foreground">
            Search for research papers and view them organized in intelligent clusters
          </p>
        </div>

        {/* Search Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="mr-2 h-5 w-5" />
              Search Papers
            </CardTitle>
            <CardDescription>
              Enter a research topic to fetch and cluster related papers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Input
                placeholder="e.g., machine learning, artificial intelligence, quantum computing..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                disabled={loading}
              />
              <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Network className="mr-2 h-4 w-4" />
                )}
                Cluster Papers
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {loading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium">Clustering Papers...</p>
                <p className="text-sm text-muted-foreground">This may take a few moments</p>
              </div>
            </CardContent>
          </Card>
        )}

        {backendError && (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-4">
              <div className="flex items-start space-x-2 text-destructive">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Backend Error</h4>
                  <p className="text-sm text-muted-foreground">{backendError}</p>
                  {useMockData && (
                    <p className="text-sm mt-2">Using sample data for visualization testing. Connect to a properly configured backend for real data.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {clusterData && !loading && (
          <div className={`grid gap-6 ${selectedPaper ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {/* Cluster Tree with Tabs */}
            <Card className="h-[600px]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center">
                  <Network className="mr-2 h-5 w-5" />
                  Research Clusters
                  {useMockData && <Badge variant="outline" className="ml-2 text-amber-600">DEMO DATA</Badge>}
                </CardTitle>
                <CardDescription>
                  Hierarchical organization of {clusterData.nodes.length} clusters
                </CardDescription>
              </CardHeader>
              <Tabs defaultValue="tree" className="w-full">
                <div className="px-6">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="list">
                      <Folder className="mr-2 h-4 w-4" />
                      List View
                    </TabsTrigger>
                    <TabsTrigger value="tree">
                      <PieChart className="mr-2 h-4 w-4" />
                      Tree View
                    </TabsTrigger>
                    <TabsTrigger value="density">
                      <Zap className="mr-2 h-4 w-4" />
                      Density View
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="list" className="mt-0">
                  <CardContent className="overflow-y-auto h-[1425px]">
                    {getRootNodes().map(node => renderClusterNode(node))}
                  </CardContent>
                </TabsContent>
                <TabsContent value="tree" className="mt-0">
                  <div className="h-[1425px] border-t">
                    {clusterData ? (
                      <HierarchicalTree 
                        clusterData={clusterData}
                        onNodeSelect={setSelectedNode}
                        selectedNodeId={selectedNode?.id}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No cluster data available</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="density" className="mt-0">
                  <div className="h-[1425px] border-t">
                    {clusterData ? (
                      <PaperDensityView 
                        clusterData={clusterData}
                        searchQuery={searchQuery}
                        onPaperSelect={setSelectedPaper}
                        selectedPaper={selectedPaper}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No cluster data available</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>

            {/* Selected Cluster Papers or AI Analysis */}
            {selectedPaper ? (
              /* AI Analysis with Tabs - Full Column */
              <div className="lg:col-span-1">
                <Card className="h-[1800px] overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">AI Analysis</CardTitle>
                    <CardDescription>
                      Advanced AI-powered analysis for: {selectedPaper.title.slice(0, 60)}...
                    </CardDescription>
                  </CardHeader>
                  <Tabs defaultValue="summary" className="flex-1 flex flex-col">
                    <div className="px-6">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="summary">
                          AI Summary
                        </TabsTrigger>
                        <TabsTrigger value="gaps">
                          Research Gaps
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="summary" className="flex-1 mt-0">
                      <div className="h-full">
                        <AIPaperSummary 
                          paper={selectedPaper}
                          onClose={() => setSelectedPaper(null)}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="gaps" className="flex-1 mt-0">
                      <div className="h-full">
                        <ResearchGapAnalysis
                          paper={selectedPaper}
                          onClose={() => setSelectedPaper(null)}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </Card>
              </div>
            ) : (
              /* Selected Cluster Papers */
              <Card className="h-[1800px]">
                <CardHeader>
                  <CardTitle>
                    {selectedNode ? `Papers in "${selectedNode.label}"` : "Select a Cluster"}
                  </CardTitle>
                  <CardDescription>
                    {selectedNode 
                      ? `${selectedNode.papers.length} papers in this cluster`
                      : "Click on a cluster to view its papers"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-y-auto h-full">
                  {selectedNode && selectedNode.papers.length > 0 ? (
                    <div className="space-y-4">
                      {selectedNode.papers.map((paper) => (
                        <Card 
                          key={paper.id} 
                          className={`border hover:shadow-md transition-shadow cursor-pointer ${
                            selectedPaper?.id === paper.id ? 'ring-2 ring-primary border-primary' : ''
                          }`}
                          onClick={() => setSelectedPaper(paper)}
                        >
                          <CardContent className="p-4">
                            <div className="mb-3">
                              <h3 className="font-bold text-lg leading-relaxed cursor-pointer hover:text-primary transition-colors mb-2 whitespace-normal break-words"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openPaperUrl(paper.url || paper.doi || '')
                                  }}>
                                {paper.title || "Untitled Paper"}
                                {(paper.url || paper.doi) && <ExternalLink className="inline ml-1 h-4 w-4" />}
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{paper.year}</Badge>
                                <Badge variant="outline">{paper.citation_count} cites</Badge>
                                {selectedPaper?.id === paper.id && (
                                  <Badge variant="default">Selected for AI Analysis</Badge>
                                )}
                              </div>
                            </div>
                            
                            {paper.abstract && (
                              <p className="text-sm text-muted-foreground mb-3 leading-relaxed whitespace-normal break-words line-clamp-3">
                                {paper.abstract}
                              </p>
                            )}
                            
                            <Separator className="mb-3" />
                            
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                              <div className="text-muted-foreground flex-1 break-words">
                                <span className="font-medium">Authors: </span>
                                {paper.authors.length > 0 
                                  ? `${paper.authors.slice(0, 2).map(a => a.name).join(", ")}${paper.authors.length > 2 ? ` +${paper.authors.length - 2} more` : ''}`
                                  : 'Unknown authors'}
                              </div>
                              
                              <div className="flex gap-2">
                                {(paper.url || paper.doi) && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openPaperUrl(paper.url || paper.doi || '')
                                    }}
                                  >
                                    <ExternalLink className="mr-1 h-3 w-3" />
                                    View
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : selectedNode ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      <div className="text-center">
                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No papers in this cluster</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      <div className="text-center">
                        <Network size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Select a cluster to view papers</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}