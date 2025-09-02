import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Search, Loader2, Network, ExternalLink, Folder, FileText } from "lucide-react"
import { getClusterTree, ClusterResponse, ClusterNode } from "@/services/paperClusteringService"
import { Paper } from "@/services/openAlexService"
import { toast } from "@/hooks/use-toast"

export function PaperSearchCluster() {
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [clusterData, setClusterData] = useState<ClusterResponse | null>(null)
  const [selectedNode, setSelectedNode] = useState<ClusterNode | null>(null)
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())

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

    try {
      const result = await getClusterTree(searchQuery, 50)
      setClusterData(result)
      
      // Auto-expand root nodes
      const rootNodes = result.nodes.filter(node => node.level === 0)
      setExpandedClusters(new Set(rootNodes.map(node => node.id)))
      
      toast({
        title: "Clustering Complete",
        description: `Generated ${result.nodes.length} clusters with ${result.edges.length} connections.`,
      })
    } catch (error) {
      console.error('Error clustering papers:', error)
      toast({
        title: "Clustering Failed",
        description: "Failed to cluster papers. Please check your backend connection.",
        variant: "destructive",
      })
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

        {clusterData && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cluster Tree */}
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Network className="mr-2 h-5 w-5" />
                  Research Clusters
                </CardTitle>
                <CardDescription>
                  Hierarchical organization of {clusterData.nodes.length} clusters
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto h-full">
                {getRootNodes().map(node => renderClusterNode(node))}
              </CardContent>
            </Card>

            {/* Selected Cluster Papers */}
            <Card className="h-[600px]">
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
                      <Card key={paper.id} className="border hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="mb-3">
                            <h3 className="font-bold text-lg leading-relaxed cursor-pointer hover:text-primary transition-colors mb-2 whitespace-normal break-words"
                                onClick={() => openPaperUrl(paper.url || paper.doi || '')}>
                              {paper.title || "Untitled Paper"}
                              {(paper.url || paper.doi) && <ExternalLink className="inline ml-1 h-4 w-4" />}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{paper.year}</Badge>
                              <Badge variant="outline">{paper.citation_count} cites</Badge>
                            </div>
                          </div>
                          
                          {paper.abstract && (
                            <p className="text-sm text-muted-foreground mb-3 leading-relaxed whitespace-normal break-words line-clamp-5">
                              {paper.abstract}
                            </p>
                          )}
                          
                          <Separator className="mb-3" />
                          
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                            <div className="text-muted-foreground flex-1 break-words">
                              <span className="font-medium">Authors: </span>
                              {paper.authors.length > 0 
                                ? `${paper.authors.slice(0, 3).map(a => a.name).join(", ")}${paper.authors.length > 3 ? ` +${paper.authors.length - 3} more` : ''}`
                                : 'Unknown authors'}
                            </div>
                            
                            {(paper.url || paper.doi) && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-shrink-0"
                                onClick={() => openPaperUrl(paper.url || paper.doi || '')}
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                View
                              </Button>
                            )}
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
          </div>
        )}
      </div>
    </div>
  )
}