// Gemini AI Service for paper summarization
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI with v1 API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '')

// Choose the model (use -flash for faster summaries if preferred)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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
 */
export async function summarizePaper(paper: any): Promise<PaperSummary> {
  console.log('🤖 [GEMINI] Starting paper summarization...')
  console.log('📄 [GEMINI] Paper:', { title: paper.title, abstract: paper.abstract?.substring(0, 100) })

  try {
    const prompt = createSummarizationPrompt(paper)

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json'
      }
    })

    const response = result.response.text()
    console.log('✅ [GEMINI] Raw response received from Gemini AI')
    console.log('📋 [GEMINI] Raw Response (first 500 chars):', response.substring(0, 500))
    console.log('📋 [GEMINI] Full Raw Response:', response)
    
    try {
      const parsed = parseSummaryResponse(response)
      console.log('✨ [GEMINI] Successfully parsed JSON response')
      console.log('📊 [GEMINI] Parsed Summary:', {
        overviewLength: parsed.overview.length,
        techniquesCount: parsed.techniques.length,
        advantagesCount: parsed.advantages.length,
        limitationsCount: parsed.limitations.length,
        keyFindingsCount: parsed.keyFindings.length,
        methodologyLength: parsed.methodology.length,
        futureWorkLength: parsed.futureWork.length,
      })
      console.log('📊 [GEMINI] Full Parsed Summary:', parsed)
      return parsed
    } catch (parseError) {
      console.error('❌ [GEMINI] JSON Parsing Error:', parseError)
      console.error('❌ [GEMINI] Failed to parse response as JSON')
      throw parseError
    }

  } catch (error) {
    console.error('❌ [GEMINI] Error generating paper summary:', error)
    throw new Error(
      `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Create a detailed prompt for paper summarization
 */
function createSummarizationPrompt(paper: any): string {
  return `You are an expert academic researcher and technical analyst. Analyze the paper below and respond with ONLY a valid JSON object. Do not include any markdown, code blocks, explanations, or text outside the JSON.

**PAPER TO ANALYZE:**
Title: ${paper.title || 'Untitled'}
Abstract: ${paper.abstract || 'No abstract available'}
Year: ${paper.year || 'Unknown'}

**REQUIREMENTS:**
- Output MUST be valid JSON only
- Do not wrap JSON in markdown code blocks or backticks
- Do not include text before or after the JSON object
- All arrays must have at least 3-4 substantial items each
- All strings must be detailed and specific
- Never use placeholder text like "not specified" or "to be determined"

**OUTPUT JSON STRUCTURE:**
{
  "overview": "4 sentences: What problem does this paper solve? What is the key contribution? Why is it significant? What is the scientific impact?",
  "techniques": ["Specific technique/method 1 with brief explanation", "Specific technique/method 2 with brief explanation", "Specific technique/method 3 with brief explanation", "Specific technique/method 4 with brief explanation"],
  "advantages": ["Specific advantage 1: How it improves over existing work", "Specific advantage 2: Unique contribution", "Specific advantage 3: Performance or scalability benefit", "Specific advantage 4: Novel approach or insight"],
  "limitations": ["Specific limitation 1: Constraint or assumption", "Specific limitation 2: Scope or resource limitation", "Specific limitation 3: Area for improvement"],
  "keyFindings": ["Finding 1: Main result or discovery", "Finding 2: Secondary important result", "Finding 3: Unexpected or notable result", "Finding 4: Practical implication"],
  "methodology": "Detailed description of the research methodology, approach, and experimental design. Include the main steps and what makes this approach unique.",
  "futureWork": "2-3 specific next steps: How could this work be extended? What problems remain? What new research directions does this open?"
}

Generate the JSON response now. Output ONLY the JSON object, nothing else.`
}

/**
 * Parse the Gemini response into structured summary
 */
function parseSummaryResponse(response: string): PaperSummary {
  try {
    console.log('🔍 [PARSE] Starting JSON parsing...')
    
    const extractJsonCandidate = (raw: string) => {
      console.log('🔍 [PARSE] Extracting JSON from response...')
      // Remove markdown code blocks if present
      let cleaned = raw
      if (cleaned.includes('```json')) {
        console.log('🔍 [PARSE] Detected ```json markdown block, removing...')
        cleaned = cleaned.split('```json')[1].split('```')[0]
      } else if (cleaned.includes('```')) {
        console.log('🔍 [PARSE] Detected ``` markdown block, removing...')
        cleaned = cleaned.split('```')[1].split('```')[0]
      }
      cleaned = cleaned.trim()
      console.log('🔍 [PARSE] Cleaned response (first 200 chars):', cleaned.substring(0, 200))

      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      console.log(`🔍 [PARSE] Found JSON bounds: start=${start}, end=${end}`)
      
      if (start === -1 || end === -1 || end <= start) {
        console.error('❌ [PARSE] Invalid JSON bounds')
        return null
      }
      
      let candidate = cleaned.slice(start, end + 1)
      candidate = candidate.replace(/[\u0000-\u001F\u007F]/g, ' ')
      console.log('🔍 [PARSE] Extracted candidate (first 300 chars):', candidate.substring(0, 300))

      return candidate
    }

    const jsonCandidate = extractJsonCandidate(response)
    if (!jsonCandidate) throw new Error('No valid JSON found in response')

    console.log('🔍 [PARSE] Attempting JSON.parse()...')
    const parsed = JSON.parse(jsonCandidate)
    console.log('✅ [PARSE] JSON parsed successfully!')
    console.log('📊 [PARSE] Parsed object keys:', Object.keys(parsed))
    console.log('📊 [PARSE] Raw parsed object:', parsed)

    const cleanNotSpecified = (value: string | string[]): string | string[] => {
      if (Array.isArray(value)) {
        return value.filter(
          item =>
            typeof item === 'string' &&
            !item.toLowerCase().includes('not specified') &&
            !item.toLowerCase().includes('not available') &&
            !item.toLowerCase().includes('to be determined') &&
            item.trim().length > 0
        )
      }
      if (
        typeof value === 'string' &&
        (value.toLowerCase().includes('not specified') ||
          value.toLowerCase().includes('not available') ||
          value.toLowerCase().includes('to be determined') ||
          value.trim().length === 0)
      ) {
        return ''
      }
      return value
    }

    // Ensure all arrays have minimum length
    const ensureArrayLength = (arr: any[], minLength: number, fallback: string) => {
      const cleaned = cleanNotSpecified(arr || []) as string[]
      if (cleaned.length < minLength) {
        return [...cleaned, ...Array(minLength - cleaned.length).fill(fallback)]
      }
      return cleaned
    }

    return {
      overview:
        parsed.overview ||
        'This paper presents research findings that contribute to the field of study.',
      techniques: ensureArrayLength(parsed.techniques || [], 3, 'Advanced research methodology'),
      advantages: ensureArrayLength(parsed.advantages || [], 3, 'Contributes to scientific knowledge'),
      limitations: ensureArrayLength(parsed.limitations || [], 2, 'Areas for future research'),
      keyFindings: ensureArrayLength(parsed.keyFindings || [], 3, 'Significant research findings'),
      methodology:
        (cleanNotSpecified(parsed.methodology || '') as string) ||
        'Research conducted using established methodologies in the field',
      futureWork:
        (cleanNotSpecified(parsed.futureWork || '') as string) ||
        'Future research will build upon these findings to advance the field further'
    }
  } catch (error) {
    console.error('Error parsing summary response:', error)
    return {
      overview:
        'Unable to generate detailed summary. Please check the paper content and try again.',
      techniques: ['Analysis of research methods', 'Evaluation of approaches', 'Technical investigation'],
      advantages: ['Contributes to scientific knowledge', 'Advances field understanding', 'Provides new insights'],
      limitations: ['Further research needed', 'Extended evaluation required'],
      keyFindings: ['Important research findings', 'Significant contributions', 'Novel insights'],
      methodology: 'Research methodology based on established scientific practices',
      futureWork: 'Future directions include extended analysis and broader applications'
    }
  }
}

/**
 * Generate a quick summary for multiple papers (batch processing)
 */
export async function generateQuickSummaries(
  papers: any[]
): Promise<Map<string, string>> {
  const summaries = new Map<string, string>()

  try {
    const batchSize = 3
    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize)

      const promises = batch.map(async paper => {
        try {
          const quickPrompt = `
Provide a 2-sentence summary of this research paper:
Title: ${paper.title}
Abstract: ${paper.abstract?.substring(0, 500) || 'No abstract'}

Focus on: What problem it solves and what the main contribution is.
`

          const result = await model.generateContent({
            contents: [
              {
                role: 'user',
                parts: [{ text: quickPrompt }]
              }
            ],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 200
            }
          })

          const response = result.response.text()
          return { id: paper.id, summary: response.trim() || 'Summary generation failed' }
        } catch (error) {
          console.error(`Error summarizing paper ${paper.id}:`, error)
          return { id: paper.id, summary: 'Summary generation failed' }
        }
      })

      const batchResults = await Promise.all(promises)
      batchResults.forEach(({ id, summary }) => {
        summaries.set(id, summary)
      })

      if (i + batchSize < papers.length) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }
  } catch (error) {
    console.error('Error in batch summary generation:', error)
  }

  return summaries
}
