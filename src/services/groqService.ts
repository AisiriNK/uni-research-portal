// Groq AI Service for Research Gap Analysis
import Groq from 'groq-sdk'

// Initialize Groq client
let groqClient: Groq | null = null

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY
    if (!apiKey) {
      throw new Error('VITE_GROQ_API_KEY environment variable is required')
    }
    groqClient = new Groq({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Allow usage in browser
    })
  }
  return groqClient
}

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Generate a chat completion using Groq
 */
export async function generateChatCompletion(
  messages: GroqChatMessage[],
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
  } = {}
): Promise<string> {
  try {
    const client = getGroqClient()
    
    const completion = await client.chat.completions.create({
      messages,
      model: options.model || 'llama-3.3-70b-versatile',
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: false
    })

    return completion.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('Groq API error:', error)
    throw new Error(`Groq API failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Test Groq connection
 */
export async function testGroqConnection(): Promise<boolean> {
  try {
    const response = await generateChatCompletion([
      {
        role: 'user',
        content: 'Please respond with just "Groq is working correctly"'
      }
    ])
    
    return response.includes('Groq is working correctly')
  } catch (error) {
    console.error('Groq connection test failed:', error)
    return false
  }
}

/**
 * Extract future work directions from research papers using Groq
 */
export async function extractFutureWorkDirections(papers: Array<{
  title: string
  abstract?: string
  year?: number
}>): Promise<string[]> {
  if (papers.length === 0) {
    return []
  }

  const papersContext = papers.map(p => 
    `Title: ${p.title}\nAbstract: ${p.abstract || 'No abstract available'}\nYear: ${p.year || 'Unknown'}\n---`
  ).join('\n')

  const messages: GroqChatMessage[] = [
    {
      role: 'system',
      content: 'You are a research analyst specialized in identifying future research directions from academic papers. Your task is to extract and summarize common future work directions and research gaps mentioned across multiple papers.'
    },
    {
      role: 'user',
      content: `Analyze the following research papers and extract common future work directions and research gaps mentioned:

${papersContext}

Extract and list the most commonly mentioned future work directions and research gaps. Focus on:
1. Technical limitations that need addressing
2. Unexplored applications or domains
3. Methodological improvements suggested
4. Data or evaluation challenges mentioned

Return only a JSON array of strings, each representing a distinct research direction:
["direction1", "direction2", "direction3"]

Important: Return valid JSON only, no additional text or formatting.`
    }
  ]

  try {
    const response = await generateChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 2048
    })

    // Try to parse JSON from the response
    let directions: string[] = []
    try {
      // Clean the response to extract JSON
      const cleanResponse = response.trim()
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/)
      
      if (jsonMatch) {
        directions = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: try to parse the entire response
        directions = JSON.parse(cleanResponse)
      }
      
      if (!Array.isArray(directions)) {
        throw new Error('Response is not an array')
      }
      
    } catch (parseError) {
      console.warn('Failed to parse Groq JSON response:', parseError)
      console.warn('Raw response:', response)
      
      // Fallback: extract directions from text response
      directions = extractDirectionsFromText(response)
    }

    return directions.filter(dir => dir && dir.trim().length > 0).slice(0, 10)
  } catch (error) {
    console.error('Error extracting future work with Groq:', error)
    return []
  }
}

/**
 * Generate research gaps using Groq
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
    year?: number
  }>
}): Promise<Array<{
  title: string
  description: string
  justification: string
  confidence: number
  category: string
}>> {
  const messages: GroqChatMessage[] = [
    {
      role: 'system',
      content: 'You are a research analyst with expertise in identifying valuable research gaps and opportunities. Your task is to analyze existing research and identify specific, actionable research gaps that would be valuable to pursue.'
    },
    {
      role: 'user',
      content: `You are a research analyst. Based on the following paper and related work analysis, identify specific research gaps that would be valuable to pursue:

Base Paper: ${context.basePaper.title}
Abstract: ${context.basePaper.abstract}
Year: ${context.basePaper.year || 'Unknown'}

Related Papers Count: ${context.relatedCount}
Common Future Directions: ${context.futureDirections.join(', ')}

Recent Related Work:
${context.recentPapers.map(p => `- ${p.title} (${p.year || 'Unknown'})`).join('\n')}

Identify 3-5 specific, actionable research gaps. For each gap, provide:
1. A clear title
2. Detailed description of what needs to be researched
3. Justification for why this is a valuable gap
4. Confidence level (0.1-1.0)
5. Research category (e.g., "methodology", "application", "theory", "empirical")

Return a JSON array of research gaps:
[{
  "title": "Gap Title",
  "description": "Detailed description of the research gap",
  "justification": "Why this gap is important and valuable",
  "confidence": 0.8,
  "category": "methodology"
}]

Important: Return valid JSON only, no additional text or formatting.`
    }
  ]

  try {
    const response = await generateChatCompletion(messages, {
      temperature: 0.8,
      maxTokens: 3072
    })

    // Try to parse JSON from the response
    let gaps: any[] = []
    try {
      // Clean the response to extract JSON
      const cleanResponse = response.trim()
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/)
      
      if (jsonMatch) {
        gaps = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: try to parse the entire response
        gaps = JSON.parse(cleanResponse)
      }
      
      if (!Array.isArray(gaps)) {
        throw new Error('Response is not an array')
      }
      
    } catch (parseError) {
      console.warn('Failed to parse Groq JSON response:', parseError)
      console.warn('Raw response:', response)
      
      // Fallback: create basic gaps from text response
      gaps = createFallbackGaps(response, context.basePaper.title)
    }

    return gaps.map((gap: any) => ({
      title: gap.title || 'Research Gap',
      description: gap.description || 'Gap analysis based on available literature',
      justification: gap.justification || 'Identified through systematic literature analysis',
      confidence: typeof gap.confidence === 'number' ? Math.min(Math.max(gap.confidence, 0.1), 1.0) : 0.5,
      category: gap.category || 'general'
    }))
  } catch (error) {
    console.error('Error generating research gaps with Groq:', error)
    return []
  }
}

/**
 * Extract research directions from text when JSON parsing fails
 */
function extractDirectionsFromText(text: string): string[] {
  const directions: string[] = []
  
  // Try to find numbered or bulleted lists
  const listMatches = text.match(/(?:^\d+\.|^[-*•])\s*(.+)$/gm)
  if (listMatches) {
    directions.push(...listMatches.map(match => 
      match.replace(/^\d+\.|^[-*•]\s*/, '').trim()
    ))
  }
  
  // Try to find quoted strings
  const quotedMatches = text.match(/"([^"]+)"/g)
  if (quotedMatches) {
    directions.push(...quotedMatches.map(match => 
      match.replace(/"/g, '').trim()
    ))
  }
  
  // If no structured content found, split by common delimiters
  if (directions.length === 0) {
    const lines = text.split(/[.\n;]/)
      .map(line => line.trim())
      .filter(line => line.length > 10 && line.length < 200)
    
    directions.push(...lines.slice(0, 5))
  }
  
  return directions.filter(dir => dir.length > 0).slice(0, 10)
}

/**
 * Create fallback research gaps when JSON parsing fails
 */
function createFallbackGaps(text: string, paperTitle: string): any[] {
  const gaps: any[] = []
  
  // Extract potential gap topics from text
  const sentences = text.split(/[.!?]/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 300)
  
  sentences.slice(0, 3).forEach((sentence, index) => {
    gaps.push({
      title: `Research Opportunity ${index + 1}`,
      description: sentence,
      justification: `Identified through analysis of literature related to "${paperTitle}"`,
      confidence: 0.6,
      category: 'general'
    })
  })
  
  // If no sentences found, create a generic gap
  if (gaps.length === 0) {
    gaps.push({
      title: 'Further Research Needed',
      description: 'Additional research opportunities exist in this domain based on literature analysis',
      justification: 'Systematic analysis suggests unexplored areas for investigation',
      confidence: 0.5,
      category: 'general'
    })
  }
  
  return gaps
}
