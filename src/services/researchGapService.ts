// Research Gap Analysis Service using OpenAlex and Groq AI
import { Paper } from './openAlexService'
import {
  extractFutureWorkDirections,
  generateResearchGaps as generateGroqResearchGaps,
  testGroqConnection
} from './groqService'

interface ResearchGap {
  id: string
  title: string
  description: string
  justification: string
  relatedPapers: string[]
  confidence: number
  category: string
  isValidated: boolean
  existingWork?: Paper[]
}

interface GapAnalysisResult {
  gaps: ResearchGap[]
  totalRelatedPapers: number
  analysisDate: string
  basePaper: Paper
}

/**
 * Find research gaps for a given paper by analyzing related work and future directions
 */
export async function findResearchGaps(selectedPaper: Paper): Promise<GapAnalysisResult> {
  try {
    console.log('Starting research gap analysis for:', selectedPaper.title)
    
    // Step 1: Fetch related papers from OpenAlex
    const relatedPapers = await fetchRelatedPapers(selectedPaper)
    console.log(`Found ${relatedPapers.length} related papers`)
    
    // Step 2: Extract future work and research directions from papers
    const futureWorkAnalysis = await extractFutureWork(relatedPapers)
    
    // Step 3: Generate potential research gaps using Groq AI
    const potentialGaps = await generateResearchGaps(selectedPaper, relatedPapers, futureWorkAnalysis)
    
    // Step 4: Validate gaps by checking if work already exists
    const validatedGaps = await validateResearchGaps(potentialGaps)
    
    return {
      gaps: validatedGaps,
      totalRelatedPapers: relatedPapers.length,
      analysisDate: new Date().toISOString(),
      basePaper: selectedPaper
    }
    
  } catch (error) {
    console.error('Error in research gap analysis:', error)
    throw new Error(`Failed to analyze research gaps: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Fetch related papers using OpenAlex based on concepts, authors, and citations
 */
async function fetchRelatedPapers(basePaper: Paper): Promise<Paper[]> {
  try {
    const relatedPapers: Paper[] = []
    
    // Build search queries for related work
    const queries = buildRelatedPaperQueries(basePaper)
    
    for (const query of queries) {
      try {
        const response = await fetch(
          `https://api.openalex.org/works?${query}&per-page=20&sort=cited_by_count:desc`
        )
        
        if (!response.ok) continue
        
        const data = await response.json()
        
        if (data.results) {
          const papers = data.results.map(transformOpenAlexWork).filter(Boolean)
          relatedPapers.push(...papers)
        }
      } catch (error) {
        console.warn('Error fetching for query:', query, error)
        continue
      }
    }
    
    // Remove duplicates and filter out the base paper
    const uniquePapers = removeDuplicates(relatedPapers)
      .filter(paper => paper.id !== basePaper.id)
      .slice(0, 50) // Limit to top 50 related papers
    
    return uniquePapers
    
  } catch (error) {
    console.error('Error fetching related papers:', error)
    return []
  }
}

/**
 * Build search queries for finding related papers
 */
function buildRelatedPaperQueries(paper: Paper): string[] {
  const queries: string[] = []
  
  // Query by main concepts from title
  if (paper.title) {
    const titleKeywords = extractKeywords(paper.title)
    if (titleKeywords.length > 0) {
      queries.push(`search=${encodeURIComponent(titleKeywords.slice(0, 3).join(' '))}`)
    }
  }
  
  // Query by author collaborations
  if (paper.authors && paper.authors.length > 0) {
    const mainAuthor = paper.authors[0]
    if (mainAuthor.name) {
      queries.push(`search=${encodeURIComponent(mainAuthor.name)}&filter=type:article`)
    }
  }
  
  // Query by field/venue
  if (paper.venue) {
    queries.push(`search=${encodeURIComponent(paper.venue)}&filter=type:article`)
  }
  
  return queries
}

/**
 * Extract keywords from text for search queries
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'via', 'using', 'based', 'approach', 'method'])
  
  return text.toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5)
}

/**
 * Transform OpenAlex work to our Paper format
 */
function transformOpenAlexWork(work: any): Paper | null {
  try {
    return {
      id: work.id || '',
      title: work.title || work.display_name || '',
      abstract: work.abstract || '',
      authors: work.authorships?.map((auth: any) => ({
        name: auth.author?.display_name || 'Unknown',
        id: auth.author?.id || ''
      })) || [],
      year: work.publication_year || new Date().getFullYear(),
      citation_count: work.cited_by_count || 0,
      url: work.primary_location?.landing_page_url || '',
      doi: work.doi || '',
      concepts: work.concepts?.map((concept: any) => ({
        id: concept.id || '',
        name: concept.display_name || '',
        score: concept.score || 0
      })) || [],
      venue: work.primary_location?.source?.display_name || ''
    }
  } catch (error) {
    console.warn('Error transforming work:', error)
    return null
  }
}

/**
 * Remove duplicate papers based on title similarity
 */
function removeDuplicates(papers: Paper[]): Paper[] {
  const seen = new Set<string>()
  return papers.filter(paper => {
    const normalizedTitle = paper.title.toLowerCase().replace(/\W+/g, ' ').trim()
    if (seen.has(normalizedTitle)) {
      return false
    }
    seen.add(normalizedTitle)
    return true
  })
}

/**
 * Extract future work and research directions from papers using Groq AI
 */
async function extractFutureWork(papers: Paper[]): Promise<string[]> {
  try {
    return await extractFutureWorkDirections(papers.map(p => ({
      title: p.title,
      abstract: p.abstract,
      year: p.year
    })))
  } catch (error) {
    console.error('Error extracting future work:', error)
    return []
  }
}

/**
 * Generate research gaps using Groq AI based on the analysis
 */
async function generateResearchGaps(
  basePaper: Paper, 
  relatedPapers: Paper[], 
  futureDirections: string[]
): Promise<ResearchGap[]> {
  try {
    const context = {
      basePaper: {
        title: basePaper.title,
        abstract: basePaper.abstract || 'No abstract available',
        year: basePaper.year
      },
      relatedCount: relatedPapers.length,
      futureDirections: futureDirections.slice(0, 10),
      recentPapers: relatedPapers.slice(0, 5).map(p => ({
        title: p.title,
        year: p.year
      }))
    }
    
    const gaps = await generateGroqResearchGaps(context)
    
    return gaps.map((gap: any, index: number) => ({
      id: `gap-${Date.now()}-${index}`,
      title: gap.title || `Research Gap ${index + 1}`,
      description: gap.description || 'Gap analysis based on available literature',
      justification: gap.justification || 'Identified through systematic literature analysis',
      relatedPapers: relatedPapers.slice(0, 5).map(p => p.id),
      confidence: typeof gap.confidence === 'number' ? gap.confidence : 0.5,
      category: gap.category || 'general',
      isValidated: false
    }))
    
  } catch (error) {
    console.error('Error generating research gaps:', error)
    return []
  }
}

/**
 * Validate research gaps by checking if similar work already exists
 */
async function validateResearchGaps(gaps: ResearchGap[]): Promise<ResearchGap[]> {
  const validatedGaps: ResearchGap[] = []
  
  for (const gap of gaps) {
    try {
      // Search for existing work on this research gap
      const searchQuery = encodeURIComponent(gap.title)
      const response = await fetch(
        `https://api.openalex.org/works?search=${searchQuery}&per-page=5&sort=relevance_score:desc`
      )
      
      if (response.ok) {
        const data = await response.json()
        const existingWork = data.results?.map(transformOpenAlexWork).filter(Boolean) || []
        
        // Check if substantial work already exists
        const hasSubstantialWork = existingWork.length > 0 && 
          existingWork.some((paper: Paper) => paper.year >= 2020)
        
        validatedGaps.push({
          ...gap,
          isValidated: true,
          existingWork: hasSubstantialWork ? existingWork : undefined
        })
      } else {
        // If validation fails, include the gap anyway
        validatedGaps.push({
          ...gap,
          isValidated: false
        })
      }
    } catch (error) {
      console.warn('Error validating gap:', gap.title, error)
      validatedGaps.push({
        ...gap,
        isValidated: false
      })
    }
  }
  
  return validatedGaps
}

export type { ResearchGap, GapAnalysisResult }
