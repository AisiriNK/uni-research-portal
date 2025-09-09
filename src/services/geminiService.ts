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
You are an expert academic researcher and technical writer. Analyze the following research paper and provide a comprehensive, structured summary.

**Paper Details:**
Title: ${paper.title || 'No title provided'}
Abstract: ${paper.abstract || 'No abstract provided'}
Year: ${paper.year || 'Unknown'}
Citation Count: ${paper.citation_count || 0}
Authors: ${paper.authors?.map((a: any) => a.name).join(', ') || 'Unknown authors'}
Venue: ${paper.venue || 'Unknown venue'}

**Instructions:**
Provide a detailed analysis in the following JSON format. Be specific, technical, and accurate. Focus on practical insights that would help researchers understand the paper's contribution.

{
  "overview": "A clear, concise 3-4 sentence overview of what this paper is about and its main contribution",
  "techniques": ["List the main technical methods, algorithms, or approaches used", "Include specific names of techniques, models, or frameworks", "Mention any novel methodologies introduced"],
  "advantages": ["Key strengths and benefits of the proposed approach", "Performance improvements or novel capabilities", "Practical applications and use cases"],
  "limitations": ["Acknowledged limitations by the authors", "Potential weaknesses or constraints", "Areas for improvement or unresolved issues"],
  "keyFindings": ["Most important results and discoveries", "Quantitative results if available", "Breakthrough insights or conclusions"],
  "methodology": "Detailed description of the experimental setup, datasets used, evaluation metrics, and research methodology",
  "futureWork": "Suggested directions for future research, potential extensions, and open questions identified by the authors"
}

**Requirements:**
- Be specific and technical but accessible
- Focus on actionable insights
- Include quantitative results when mentioned
- Highlight practical implications
- Maintain academic rigor while being concise
- If information is not available in the abstract/title, indicate "Not specified in available content"

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
    
    // Validate required fields and provide defaults
    return {
      overview: parsed.overview || 'No overview available',
      techniques: Array.isArray(parsed.techniques) ? parsed.techniques : [],
      advantages: Array.isArray(parsed.advantages) ? parsed.advantages : [],
      limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      methodology: parsed.methodology || 'Methodology not specified',
      futureWork: parsed.futureWork || 'Future work not specified'
    }
  } catch (error) {
    console.error('Error parsing summary response:', error)
    // Return fallback summary
    return {
      overview: 'Unable to generate detailed summary. Please check the paper content.',
      techniques: [],
      advantages: [],
      limitations: [],
      keyFindings: [],
      methodology: 'Analysis failed',
      futureWork: 'Analysis failed'
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
