// Custom hierarchical tree component for better display
import React from 'react'
import { ClusterResponse, ClusterNode } from '@/services/paperClusteringService'
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react'

interface HierarchicalTreeProps {
  clusterData: ClusterResponse
  onNodeSelect: (node: ClusterNode) => void
  selectedNodeId?: string
}

interface TreeNodeProps {
  node: ClusterNode
  children: ClusterNode[]
  level: number
  onNodeSelect: (node: ClusterNode) => void
  selectedNodeId?: string
}

export function HierarchicalTree({ clusterData, onNodeSelect, selectedNodeId }: HierarchicalTreeProps) {
  if (!clusterData || !clusterData.nodes) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No cluster data available</p>
      </div>
    )
  }

  // Find root nodes
  const rootNodes = clusterData.nodes.filter(node => node.level === 0)
  
  return (
    <div className="p-4 space-y-2 overflow-auto h-full">
      {rootNodes.map(rootNode => (
        <TreeNodeComponent
          key={rootNode.id}
          node={rootNode}
          children={getChildNodes(clusterData, rootNode.id)}
          level={0}
          onNodeSelect={onNodeSelect}
          selectedNodeId={selectedNodeId}
        />
      ))}
    </div>
  )
}

function TreeNodeComponent({ node, children, level, onNodeSelect, selectedNodeId }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = React.useState(level < 2) // Auto-expand first 2 levels
  const hasChildren = children.length > 0
  const hasPapers = node.papers && node.papers.length > 0
  const isSelected = selectedNodeId === node.id
  
  const getLevelStyle = (level: number) => {
    switch (level) {
      case 0: return 'text-lg font-bold text-blue-900 bg-blue-50'
      case 1: return 'text-base font-semibold text-blue-700 bg-blue-25'
      case 2: return 'text-sm font-medium text-blue-600'
      case 3: return 'text-sm text-blue-800'
      default: return 'text-sm text-gray-600'
    }
  }
  
  const getIcon = () => {
    if (hasPapers) return <FileText className="w-4 h-4 text-green-600" />
    if (hasChildren) {
      return isExpanded ? 
        <ChevronDown className="w-4 h-4 text-blue-600" /> : 
        <ChevronRight className="w-4 h-4 text-blue-600" />
    }
    return <Folder className="w-4 h-4 text-gray-400" />
  }
  
  return (
    <div className="space-y-1">
      <div 
        className={`
          flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all
          hover:bg-blue-100 hover:shadow-sm
          ${isSelected ? 'bg-blue-200 ring-2 ring-blue-400' : ''}
          ${getLevelStyle(level)}
        `}
        style={{ marginLeft: `${level * 20}px` }}
        onClick={() => {
          if (hasChildren) setIsExpanded(!isExpanded)
          onNodeSelect(node)
        }}
      >
        {getIcon()}
        
        <span className="flex-1 truncate">
          {node.label}
        </span>
        
        <div className="flex items-center gap-2 text-xs">
          {node.paper_count > 0 && (
            <span className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${hasPapers ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
            `}>
              {node.paper_count} papers
            </span>
          )}
          
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            L{node.level}
          </span>
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {children.map(child => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              children={getChildNodes(children, child.id)}
              level={level + 1}
              onNodeSelect={onNodeSelect}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function getChildNodes(clusterData: ClusterResponse | ClusterNode[], parentId: string): ClusterNode[] {
  if (Array.isArray(clusterData)) {
    return clusterData.filter(node => node.parent_id === parentId)
  }
  return clusterData.nodes.filter(node => node.parent_id === parentId)
}
