// Groq AI Service for Research Gap Analysis

// Now routes through backend API instead of direct Groq SDK calls

import { API_CONFIG, buildApiUrl } from '@/config/api'

// Backend API base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Generate a chat completion using Groq (via backend)
 */
export async function generateChatCompletion(
  messages: GroqChatMessage[],
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
  } = {}
): Promise<string> {
  // This function is deprecated - use backend endpoints directly
  // Keeping for backward compatibility
  throw new Error('Direct Groq chat completion is deprecated. Use specific endpoints like generateResearchGaps instead.')
}

/**
 * Test Groq connection (via backend health check)
 */
export async function testGroqConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`)
    if (!response.ok) {
      console.error('Backend health check failed:', response.status)
      return false
    }
    
    const data = await response.json()
    console.log('Backend health response:', data)
    // Check both possible field names for backward compatibility
    return data.groq_configured === true || data.groq_api_configured === true
  } catch (error) {
    console.error('Groq connection test failed:', error)
    return false
  }
}

/**
 * Extract future work directions from research papers
 * This is now a simplified version that extracts basic patterns
 * For advanced analysis, use the backend /api/generate-research-gaps endpoint
 */
export async function extractFutureWorkDirections(papers: Array<{
  title: string
  abstract?: string
  year?: number
}>): Promise<string[]> {
  if (papers.length === 0) {
    return []
  }

  // Simple extraction - look for common patterns in abstracts
  const directions: string[] = []
  const keywords = ['future work', 'future research', 'further', 'explore', 'investigate', 'improve', 'enhance', 'extend']
  
  papers.forEach(paper => {
    if (!paper.abstract) return
    
    const abstract = paper.abstract.toLowerCase()
    keywords.forEach(keyword => {
      if (abstract.includes(keyword)) {
        const sentences = paper.abstract!.split(/[.!?]/)
        sentences.forEach(sentence => {
          if (sentence.toLowerCase().includes(keyword) && sentence.length > 20 && sentence.length < 200) {
            directions.push(sentence.trim())
          }
        })
      }
    })
  })
  
  // Remove duplicates and limit
  const uniqueDirections = [...new Set(directions)]
  return uniqueDirections.slice(0, 10)
}

/**
 * Generate research gaps using Groq (via backend API)
 */
export async function generateResearchGaps(context: {
  basePaper: {
    title: string
    abstract: string
    year?: number
  }
  relatedCount: number
  futureDirections: string[]
  recentPapers: Array<{
    title: string
    abstract?: string
    year?: number
  }>
}): Promise<Array<{
  title: string
  description: string
  justification: string
  confidence: number
  category: string
}>> {
  try {
    console.log('Generating research gaps via backend API...')
    
    // Call backend endpoint
    const params = new URLSearchParams({
      base_paper_title: context.basePaper.title,
      base_paper_abstract: context.basePaper.abstract || '',
      related_papers_data: JSON.stringify(context.recentPapers.map(p => ({
        title: p.title,
        abstract: p.abstract || '',
        year: p.year
      }))),
      domain: 'Computer Science'
    })
    
    const response = await fetch(`${BACKEND_URL}/api/generate-research-gaps?${params}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend API error response:', errorText)
      throw new Error(`Backend API error: ${response.status} ${errorText}`)
    }
    
    const data = await response.json()
    
    if (!data.success || !Array.isArray(data.gaps)) {
      console.error('Invalid backend response:', data)
      throw new Error('Invalid response format from backend')
    }
    
    console.log(`Successfully generated ${data.gaps.length} research gaps`)
    
    return data.gaps.map((gap: any) => ({
      title: gap.title || 'Research Gap',
      description: gap.description || 'Gap analysis based on available literature',
      justification: gap.justification || 'Identified through systematic literature analysis',
      confidence: typeof gap.confidence === 'number' ? Math.min(Math.max(gap.confidence, 0.1), 1.0) : 0.5,
      category: gap.category || 'general'
    }))
  } catch (error) {
    console.error('Error generating research gaps:', error)
    // Return empty array instead of throwing to prevent complete failure
    return []
  }
}

// Helper functions removed - now using backend API
