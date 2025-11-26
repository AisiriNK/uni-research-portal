// Tree structure converter for react-d3-tree
import { ClusterResponse, ClusterNode } from '@/services/paperClusteringService'

// react-d3-tree expects this format
export interface TreeNode {
  name: string
  attributes?: {
    level: number
    paper_count: number
    node_id: string
    has_papers: boolean
  }
  children?: TreeNode[]
}

// Store papers separately for node selection
export const nodePapersMap = new Map<string, any[]>()

/**
 * Convert our backend cluster structure to react-d3-tree format
 * @param clusterData - The cluster response from backend
 * @returns TreeNode in react-d3-tree format
 */
export function convertToTreeFormat(clusterData: ClusterResponse): TreeNode | null {
  if (!clusterData || !clusterData.nodes || clusterData.nodes.length === 0) {
    return null
  }

  // Clear previous papers map
  nodePapersMap.clear()

  // Find root node (level 0)
  const rootNode = clusterData.nodes.find(node => node.level === 0)
  if (!rootNode) {
    return null
  }

  // Build the tree recursively
  return buildTreeNode(rootNode, clusterData)
}

/**
 * Recursively build tree nodes
 * @param node - Current cluster node
 * @param clusterData - Full cluster data
 * @returns TreeNode
 */
function buildTreeNode(node: ClusterNode, clusterData: ClusterResponse): TreeNode {
  // Find all children of this node
  const children = clusterData.nodes.filter(n => n.parent_id === node.id)
  
  // Store papers in the map for later retrieval
  if (node.papers && node.papers.length > 0) {
    nodePapersMap.set(node.id, node.papers)
  }
  
  // Build tree node
  const treeNode: TreeNode = {
    name: node.label,
    attributes: {
      level: node.level,
      paper_count: node.paper_count,
      node_id: node.id,
      has_papers: (node.papers && node.papers.length > 0) || false
    }
  }

  // Recursively add children
  if (children.length > 0) {
    treeNode.children = children.map(child => buildTreeNode(child, clusterData))
  }

  return treeNode
}

/**
 * Get papers for a specific node ID
 * @param nodeId - The node ID
 * @returns Array of papers or empty array
 */
export function getPapersForNode(nodeId: string): any[] {
  return nodePapersMap.get(nodeId) || []
}

/**
 * Get node styling based on level
 * @param level - Node level (0-3)
 * @returns Style object for the node
 */
export function getNodeStyle(level: number) {
  const baseStyle = {
    fill: '#ffffff',
    stroke: '#2a4d8f',
    strokeWidth: 2,
    r: 8
  }

  switch (level) {
    case 0: // Root
      return { ...baseStyle, fill: '#1e40af', r: 12 }
    case 1: // Main branches
      return { ...baseStyle, fill: '#3b82f6', r: 10 }
    case 2: // Subdomains
      return { ...baseStyle, fill: '#60a5fa', r: 8 }
    case 3: // Topics (with papers)
      return { ...baseStyle, fill: '#93c5fd', r: 6 }
    default:
      return baseStyle
  }
}

/**
 * Get label styling based on level
 * @param level - Node level (0-3)
 * @returns Style object for the label
 */
export function getLabelStyle(level: number) {
  const baseStyle = {
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    textAnchor: 'middle' as const,
    dominantBaseline: 'central' as const
  }

  switch (level) {
    case 0: // Root
      return { ...baseStyle, fontSize: '14px', fontWeight: 'bold', fill: '#1e40af' }
    case 1: // Main branches
      return { ...baseStyle, fontSize: '13px', fontWeight: 'bold', fill: '#2563eb' }
    case 2: // Subdomains
      return { ...baseStyle, fontSize: '12px', fontWeight: '600', fill: '#3b82f6' }
    case 3: // Topics
      return { ...baseStyle, fontSize: '11px', fill: '#1f2937' }
    default:
      return baseStyle
  }
}
