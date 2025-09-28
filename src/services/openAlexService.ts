// OpenAlex Service - handles paper search API calls to backend
import { API_CONFIG, buildApiUrl } from '@/config/api'
export interface Author {
  id: string;
  name: string;
  affiliation?: string;
}

export interface Concept {
  id: string;
  name: string;
  level: number;
  score: number;
}

export interface Paper {
  id: string;
  title: string;
  abstract?: string;
  authors: Author[];
  year: number;
  doi?: string;
  url?: string;
  citation_count: number;
  concepts: Concept[];
  venue?: string;
}

export interface PaperSearchResponse {
  papers: Paper[];
  count: number;
}

// Backend API base URL - now using centralized config
// const API_BASE_URL = 'http://localhost:8000';

/**
 * Search papers from OpenAlex via backend API
 * @param query - Search query for papers
 * @param limit - Number of papers to fetch (default: 20, max: 100)
 * @param yearFrom - Start year filter (default: 2015)
 * @param yearTo - End year filter (default: 2024)
 * @returns Promise with papers and count
 */
export async function searchPapers(
  query: string, 
  limit: number = 20, 
  yearFrom: number = 2015, 
  yearTo: number = 2024
): Promise<PaperSearchResponse> {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PAPERS_SEARCH, {
      query,
      limit: limit.toString(),
      year_from: yearFrom.toString(),
      year_to: yearTo.toString()
    })

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching papers:', error);
    throw new Error(`Failed to search papers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Health check for backend API
 * @returns Promise with health status
 */
export async function checkBackendHealth(): Promise<any> {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.HEALTH)
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking backend health:', error);
    throw new Error(`Backend health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}