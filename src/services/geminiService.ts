// Gemini AI Service for paper summarization
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '')

export interface PaperSummary {
  overview: string
  techniques: string[]
  advantages: string[]
  limitations: string[]
  keyFindings: string[]
  methodology: string
  futureWork: string
}

/**
 * Generate a comprehensive paper summary using Gemini AI
 * @param paper - Paper object with title, abstract, etc.
 * @returns Promise with structured summary
 */
export async function summarizePaper(paper: any): Promise<PaperSummary> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = createSummarizationPrompt(paper)
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Parse the structured response
    return parseSummaryResponse(text)
    
  } catch (error) {
    console.error('Error generating paper summary:', error)
    throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create a detailed prompt for paper summarization
 */
function createSummarizationPrompt(paper: any): string {
  return `
You are an expert academic researcher and technical writer. Analyze the following research paper and provide a comprehensive, structured summary based on the available information.

**Paper Details:**
Title: ${paper.title || 'No title provided'}
Abstract: ${paper.abstract || 'No abstract provided'}
Year: ${paper.year || 'Unknown'}
Citation Count: ${paper.citation_count || 0}
Authors: ${paper.authors?.map((a: any) => a.name).join(', ') || 'Unknown authors'}
Venue: ${paper.venue || 'Unknown venue'}

**Instructions:**
Based on the title, abstract, and metadata provided, generate intelligent insights and reasonable inferences about this research. Even with limited information, provide meaningful analysis that would help researchers understand the paper's likely contribution and significance.

Provide your analysis in the following JSON format:

{
  "overview": "A clear, insightful overview based on the title and abstract, explaining the paper's contribution and significance in the field",
  "techniques": ["Infer likely technical methods or approaches based on the title and field", "Common techniques used in this research area", "Methodological approaches suggested by the abstract"],
  "advantages": ["Potential benefits and strengths suggested by the research", "Likely improvements or contributions to the field", "Practical applications that could result from this work"],
  "limitations": ["Typical challenges in this research area", "Potential constraints that might apply", "Common limitations in similar studies"],
  "keyFindings": ["Main discoveries or results mentioned in abstract", "Significant insights suggested by the research", "Important conclusions that can be inferred"],
  "methodology": "Describe the likely research approach and methods based on the field and abstract content",
  "futureWork": "Suggest logical next steps and research directions that would build on this work"
}

**Guidelines:**
- Be intelligent and inferential - use your knowledge of the research field
- Provide meaningful content even if abstract is brief
- Focus on realistic possibilities based on the title and context
- Avoid saying "not specified" - instead provide educated insights
- Keep responses specific to the research area indicated by the title
- Generate valuable analysis that helps understand the research contribution

Please respond with valid JSON only.
`
}

/**
 * Parse the Gemini response into structured summary
 */
function parseSummaryResponse(response: string): PaperSummary {
  try {
    // Clean the response to extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response')
    }
    
    const parsed = JSON.parse(jsonMatch[0])
    
    // Helper function to clean "not specified" responses
    const cleanNotSpecified = (value: string | string[]): string | string[] => {
      if (Array.isArray(value)) {
        return value.filter(item => 
          !item.toLowerCase().includes('not specified') &&
          !item.toLowerCase().includes('not available') &&
          item.trim().length > 0
        )
      }
      if (typeof value === 'string' && (
        value.toLowerCase().includes('not specified') ||
        value.toLowerCase().includes('not available') ||
        value.trim().length === 0
      )) {
        return ''
      }
      return value
    }
    
    // Validate required fields and provide intelligent defaults
    const cleanedTechniques = cleanNotSpecified(parsed.techniques || []) as string[]
    const cleanedAdvantages = cleanNotSpecified(parsed.advantages || []) as string[]
    const cleanedLimitations = cleanNotSpecified(parsed.limitations || []) as string[]
    const cleanedKeyFindings = cleanNotSpecified(parsed.keyFindings || []) as string[]
    const cleanedMethodology = cleanNotSpecified(parsed.methodology || '') as string
    const cleanedFutureWork = cleanNotSpecified(parsed.futureWork || '') as string
    
    return {
      overview: parsed.overview || 'This paper presents research findings that contribute to the field of study.',
      techniques: cleanedTechniques.length > 0 ? cleanedTechniques : ['Research methodology based on available literature'],
      advantages: cleanedAdvantages.length > 0 ? cleanedAdvantages : ['Contributes to scientific knowledge and understanding'],
      limitations: cleanedLimitations.length > 0 ? cleanedLimitations : ['Limitations to be explored in future research'],
      keyFindings: cleanedKeyFindings.length > 0 ? cleanedKeyFindings : ['Significant research findings presented in this work'],
      methodology: cleanedMethodology || 'Methodology details available in the full paper',
      futureWork: cleanedFutureWork || 'Future research directions to be explored based on these findings'
    }
  } catch (error) {
    console.error('Error parsing summary response:', error)
    // Return fallback summary
    return {
      overview: 'Unable to generate detailed summary. Please check the paper content and try again.',
      techniques: ['Analysis requires full paper access'],
      advantages: ['Potential benefits to be determined from full paper'],
      limitations: ['Detailed evaluation needed'],
      keyFindings: ['Key insights available in complete paper'],
      methodology: 'Full methodology available in paper text',
      futureWork: 'Research directions outlined in paper conclusion'
    }
  }
}

/**
 * Generate a quick summary for multiple papers (batch processing)
 */
export async function generateQuickSummaries(papers: any[]): Promise<Map<string, string>> {
  const summaries = new Map<string, string>()
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    // Process papers in batches of 5 to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize)
      
      const promises = batch.map(async (paper) => {
        try {
          const quickPrompt = `
Provide a 2-sentence summary of this research paper:
Title: ${paper.title}
Abstract: ${paper.abstract?.substring(0, 500) || 'No abstract'}

Focus on: What problem it solves and what the main contribution is.
`
          const result = await model.generateContent(quickPrompt)
          const response = await result.response
          return { id: paper.id, summary: response.text().trim() }
        } catch (error) {
          console.error(`Error summarizing paper ${paper.id}:`, error)
          return { id: paper.id, summary: 'Summary generation failed' }
        }
      })
      
      const batchResults = await Promise.all(promises)
      batchResults.forEach(({ id, summary }) => {
        summaries.set(id, summary)
      })
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < papers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  } catch (error) {
    console.error('Error in batch summary generation:', error)
  }
  
  return summaries
}
