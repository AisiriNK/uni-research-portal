// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  ENDPOINTS: {
    HEALTH: '/api/health',
    PAPERS_SEARCH: '/api/papers/search',
    CLUSTER_TREE: '/api/tree',
    SEARCH_AND_CLUSTER: '/api/search-and-cluster',
  },
  DEFAULT_PARAMS: {
    PAPER_LIMIT: 20,
    CLUSTER_LIMIT: 50,
    YEAR_FROM: 2015,
    YEAR_TO: 2024,
  }
}

// Helper function to build API URLs
export function buildApiUrl(endpoint: string, params?: Record<string, string | number>): string {
  const url = new URL(endpoint, API_CONFIG.BASE_URL)
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString())
    })
  }
  
  return url.toString()
}
