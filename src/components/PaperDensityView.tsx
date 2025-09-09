// Paper Density Heatmap View - shows papers positioned by relevance with color-coding
import React, { useState, useEffect, useRef } from 'react'
import { ClusterResponse, ClusterNode } from '@/services/paperClusteringService'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink, FileText } from 'lucide-react'

interface PaperDensityViewProps {
  clusterData: ClusterResponse
  searchQuery: string
  onPaperSelect: (paper: any) => void
  selectedPaper?: any
}

interface PaperPosition {
  paper: any
  x: number
  y: number
  relevanceScore: number
  cluster: string
  level: number
}

export function PaperDensityView({ clusterData, searchQuery, onPaperSelect, selectedPaper }: PaperDensityViewProps) {
  const [paperPositions, setPaperPositions] = useState<PaperPosition[]>([])
  const [hoveredPaper, setHoveredPaper] = useState<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (clusterData && clusterData.nodes) {
      generatePaperPositions()
    }
  }, [clusterData, searchQuery])

  const generatePaperPositions = () => {
    const positions: PaperPosition[] = []
    const containerWidth = 650  // Reduced from 700 to 650
    const containerHeight = 400
    const centerX = containerWidth / 2 - 50  // Shift center left by 50px
    const centerY = containerHeight / 2

    // Collect all papers from all nodes
    clusterData.nodes.forEach(node => {
      if (node.papers && node.papers.length > 0) {
        node.papers.forEach(paper => {
          // Calculate relevance score based on title and abstract matching
          const relevanceScore = calculateRelevanceScore(paper, searchQuery)
          
          // Position papers in concentric circles based on relevance
          // High relevance = closer to center
          const maxDistance = Math.min(containerWidth, containerHeight) / 3
          const distance = maxDistance * (1 - relevanceScore)
          
          // Add some randomness to avoid overlapping
          const angle = Math.random() * 2 * Math.PI
          const jitter = (Math.random() - 0.5) * 30
          
          const x = centerX + Math.cos(angle) * distance + jitter
          const y = centerY + Math.sin(angle) * distance + jitter
          
          positions.push({
            paper,
            x: Math.max(20, Math.min(containerWidth - 20, x)),
            y: Math.max(20, Math.min(containerHeight - 20, y)),
            relevanceScore,
            cluster: node.label,
            level: node.level
          })
        })
      }
    })

    setPaperPositions(positions)
  }

  const calculateRelevanceScore = (paper: any, query: string): number => {
    if (!query) return 0.5 // Default relevance if no query

    const queryWords = query.toLowerCase().split(' ')
    const title = (paper.title || '').toLowerCase()
    const abstract = (paper.abstract || '').toLowerCase()
    const concepts = (paper.concepts || []).map((c: any) => c.name?.toLowerCase() || '')

    let score = 0
    let totalWords = queryWords.length

    queryWords.forEach(word => {
      // Title matches are weighted more heavily
      if (title.includes(word)) score += 0.4
      
      // Abstract matches
      if (abstract.includes(word)) score += 0.3
      
      // Concept matches
      const conceptMatch = concepts.some((concept: string) => concept.includes(word))
      if (conceptMatch) score += 0.3
    })

    // Normalize score and add citation boost
    let normalizedScore = Math.min(score / totalWords, 1)
    
    // Boost score for highly cited papers (small boost)
    const citationBoost = Math.min((paper.citation_count || 0) / 1000, 0.2)
    normalizedScore = Math.min(normalizedScore + citationBoost, 1)

    return normalizedScore
  }

  const getHeatmapColor = (relevanceScore: number): string => {
    // Create a heat map from cool (blue) to hot (red/orange)
    if (relevanceScore >= 0.8) return '#dc2626' // Hot red
    if (relevanceScore >= 0.6) return '#ea580c' // Orange-red
    if (relevanceScore >= 0.4) return '#f59e0b' // Orange
    if (relevanceScore >= 0.2) return '#eab308' // Yellow
    return '#3b82f6' // Cool blue
  }

  const getNodeSize = (relevanceScore: number, citationCount: number): number => {
    const baseSize = 8
    const relevanceBonus = relevanceScore * 8
    const citationBonus = Math.min(citationCount / 200, 4)
    return baseSize + relevanceBonus + citationBonus
  }

  const openPaperUrl = (url: string) => {
    if (url) window.open(url, '_blank')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Relevance:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-xs">Low</span>
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <div className="w-4 h-4 rounded-full bg-red-600"></div>
            <span className="text-xs">High</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {paperPositions.length} papers visualized
        </div>
      </div>

      {/* Density Visualization */}
      <div className="flex-1 relative">
        <div 
          ref={containerRef}
          className="relative w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border overflow-hidden"
          style={{ minHeight: '400px' }}
        >
          {/* Center indicator */}
          <div 
            className="absolute w-2 h-2 bg-gray-400 rounded-full opacity-50"
            style={{ 
              left: '40%',  // Moved from 50% to 40% to match new center position
              top: '50%', 
              transform: 'translate(-50%, -50%)' 
            }}
          />
          
          {/* Paper nodes */}
          {paperPositions.map((position, index) => (
            <div
              key={`${position.paper.id}-${index}`}
              className="absolute cursor-pointer transition-all duration-200 hover:scale-125 hover:z-10"
              style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)'
              }}
              onClick={() => onPaperSelect(position.paper)}
              onMouseEnter={() => setHoveredPaper(position)}
              onMouseLeave={() => setHoveredPaper(null)}
            >
              <div
                className="rounded-full shadow-md border-2 border-white"
                style={{
                  backgroundColor: getHeatmapColor(position.relevanceScore),
                  width: getNodeSize(position.relevanceScore, position.paper.citation_count || 0),
                  height: getNodeSize(position.relevanceScore, position.paper.citation_count || 0),
                  boxShadow: selectedPaper?.id === position.paper.id 
                    ? '0 0 0 3px rgba(59, 130, 246, 0.5)' 
                    : '0 2px 4px rgba(0,0,0,0.1)'
                }}
              />
            </div>
          ))}

          {/* Tooltip */}
          {hoveredPaper && (
            <div 
              className="absolute z-20 pointer-events-none"
              style={{
                left: hoveredPaper.x,
                top: hoveredPaper.y < 130 ? hoveredPaper.y + 30 : hoveredPaper.y - 120,  // Show below if too close to top, otherwise above
                transform: 'translateX(-50%)',  // Center horizontally above/below the node
                maxWidth: '320px'
              }}
            >
              <Card className="w-72 shadow-lg border-2">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold line-clamp-2 leading-tight">
                      {hoveredPaper.paper.title || 'Untitled Paper'}
                    </h4>
                    
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <Badge variant="secondary">{hoveredPaper.paper.year}</Badge>
                      <Badge variant="outline">{hoveredPaper.paper.citation_count} cites</Badge>
                      <Badge 
                        className="text-white text-xs"
                        style={{ 
                          backgroundColor: getHeatmapColor(hoveredPaper.relevanceScore)
                        }}
                      >
                        {Math.round(hoveredPaper.relevanceScore * 100)}% match
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {hoveredPaper.paper.abstract || 'No abstract available'}
                    </p>
                    
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground truncate">
                        {hoveredPaper.cluster}
                      </span>
                      {(hoveredPaper.paper.url || hoveredPaper.paper.doi) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openPaperUrl(hoveredPaper.paper.url || hoveredPaper.paper.doi)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 ml-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Selected Paper Info */}
      {selectedPaper && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">
                {selectedPaper.title || 'Untitled Paper'}
              </h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <FileText className="w-3 h-3" />
                <span>{selectedPaper.year}</span>
                <span>•</span>
                <span>{selectedPaper.citation_count} citations</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {selectedPaper.abstract || 'No abstract available'}
              </p>
            </div>
            {(selectedPaper.url || selectedPaper.doi) && (
              <button
                onClick={() => openPaperUrl(selectedPaper.url || selectedPaper.doi)}
                className="ml-4 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                View Paper
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
