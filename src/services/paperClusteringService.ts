// Paper Clustering Service - handles clustering and tree generation API calls to backend
import { Paper } from './openAlexService'
import { API_CONFIG, buildApiUrl } from '@/config/api'

export interface ClusterNode {
  id: string;
  label: string;
  level: number;
  parent_id?: string;
  papers: Paper[];
  paper_count: number;
}

export interface ClusterEdge {
  from_node: string;
  to_node: string;
}

export interface ClusterResponse {
  nodes: ClusterNode[];
  edges: ClusterEdge[];
}

export interface SearchRequest {
  query: string;
  limit?: number;
  year_from?: number;
  year_to?: number;
}

// Backend API base URL - now using centralized config
// const API_BASE_URL = 'http://localhost:8000';

/**
 * Generate clustered tree data for a research topic
 * @param topic - Research topic to search for
 * @param count - Number of papers to fetch (default: 50, max: 200)
 * @returns Promise with clustered tree structure
 */
export async function getClusterTree(
  topic: string, 
  count: number = 50
): Promise<ClusterResponse> {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.CLUSTER_TREE, {
      topic,
      count: count.toString()
    })
    
    console.log('Fetching cluster tree from:', url);
    
    const response = await fetch(url);
    
    // Log response status for debugging
    console.log('API Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Unable to read error response';
      }
      console.error('API error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Validate data structure
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      console.error('Invalid API response format:', data);
      throw new Error('Invalid API response: missing nodes or edges arrays');
    }
    
    console.log(`Received ${data.nodes.length} nodes and ${data.edges.length} edges`);
    
    return data;
  } catch (error) {
    console.error('Error fetching cluster tree:', error);
    throw new Error(`Failed to generate cluster tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search and cluster papers (legacy endpoint for backward compatibility)
 * @param searchRequest - Search parameters including query, limit, year filters
 * @returns Promise with clustered data
 */
export async function searchAndCluster(searchRequest: SearchRequest): Promise<ClusterResponse> {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.SEARCH_AND_CLUSTER)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchRequest.query,
        limit: searchRequest.limit || 50,
        year_from: searchRequest.year_from || 2015,
        year_to: searchRequest.year_to || 2024
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in search and cluster:', error);
    throw new Error(`Failed to search and cluster papers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get cluster nodes by level for hierarchical display
 * @param clusterData - Full cluster response data
 * @param level - Level to filter nodes (0 = root, 1 = categories, 2 = subcategories)
 * @returns Array of nodes at specified level
 */
export function getNodesByLevel(clusterData: ClusterResponse, level: number): ClusterNode[] {
  return clusterData.nodes.filter(node => node.level === level);
}

/**
 * Get child nodes for a parent node
 * @param clusterData - Full cluster response data
 * @param parentId - ID of parent node
 * @returns Array of child nodes
 */
export function getChildNodes(clusterData: ClusterResponse, parentId: string): ClusterNode[] {
  return clusterData.nodes.filter(node => node.parent_id === parentId);
}

/**
 * Find a specific node by ID
 * @param clusterData - Full cluster response data
 * @param nodeId - ID of node to find
 * @returns Node if found, undefined otherwise
 */
export function findNodeById(clusterData: ClusterResponse, nodeId: string): ClusterNode | undefined {
  return clusterData.nodes.find(node => node.id === nodeId);
}