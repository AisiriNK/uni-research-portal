/**
 * OpenAlex Papers Fetching Utility & Groq AI Classification
 * Fetches research papers with title, abstract, authors, year, citations, and concepts
 * Classifies papers using Groq AI into branches and subclusters
 */

const OPENALEX_BASE_URL = 'https://api.openalex.org';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Reconstruct abstract from OpenAlex inverted index format
 * @param {Object} invertedIndex - The inverted index object from OpenAlex
 * @returns {string} - Reconstructed abstract text
 */
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') {
    return '';
  }
  
  try {
    // Find the maximum position to know array size
    const allPositions = Object.values(invertedIndex).flat();
    if (allPositions.length === 0) return '';
    
    const maxPosition = Math.max(...allPositions);
    
    // Create array to hold words in correct positions
    const words = new Array(maxPosition + 1).fill('');
    
    // Place each word at its correct positions
    Object.entries(invertedIndex).forEach(([word, positions]) => {
      positions.forEach(pos => {
        if (pos >= 0 && pos <= maxPosition) {
          words[pos] = word;
        }
      });
    });
    
    // Join words, filtering out empty positions
    return words.filter(word => word !== '').join(' ');
  } catch (error) {
    console.warn('Error reconstructing abstract:', error);
    return '';
  }
}

/**
 * Parse and format a single paper from OpenAlex response
 * @param {Object} paperData - Raw paper data from OpenAlex API
 * @returns {Object} - Formatted paper object
 */
function formatPaper(paperData) {
  try {
    // Extract basic info
    const id = paperData.id || '';
    const title = paperData.title || 'Untitled';
    const year = paperData.publication_year || 0;
    const citations = paperData.cited_by_count || 0;
    
    // Reconstruct abstract from inverted index
    const abstract = paperData.abstract_inverted_index 
      ? reconstructAbstract(paperData.abstract_inverted_index)
      : '';
    
    // Extract authors
    const authors = (paperData.authorships || []).map(authorship => {
      const author = authorship.author || {};
      const institutions = authorship.institutions || [];
      
      return {
        id: author.id || '',
        name: author.display_name || 'Unknown Author',
        affiliation: institutions.length > 0 ? institutions[0].display_name : null
      };
    });
    
    // Extract concepts
    const concepts = (paperData.concepts || []).map(concept => ({
      id: concept.id || '',
      name: concept.display_name || '',
      level: concept.level || 0,
      score: concept.score || 0
    }));
    
    // Extract additional metadata
    const doi = paperData.doi || null;
    const venue = paperData.primary_location?.source?.display_name || null;
    const url = paperData.primary_location?.landing_page_url || null;
    
    return {
      id,
      title,
      abstract,
      authors,
      year,
      citations,
      concepts,
      doi,
      venue,
      url
    };
  } catch (error) {
    console.error('Error formatting paper:', error);
    return null;
  }
}

/**
 * Fetch papers from OpenAlex API
 * @param {string} query - Search query for papers
 * @param {number} count - Number of papers to fetch (max 200 per request)
 * @returns {Promise<Array>} - Array of formatted paper objects
 */
async function fetch_openalex_papers(query, count = 50) {
  // Validate inputs
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  
  if (!count || count < 1) {
    throw new Error('Count must be a positive number');
  }
  
  // OpenAlex API limits per-page to 200
  const limitedCount = Math.min(count, 200);
  
  try {
    // Build API URL with parameters
    const url = new URL(`${OPENALEX_BASE_URL}/works`);
    url.searchParams.set('search', query);
    url.searchParams.set('per-page', limitedCount.toString());
    url.searchParams.set('sort', 'cited_by_count:desc');
    url.searchParams.set('filter', 'type:article,publication_year:2000-2024');
    
    console.log('Fetching papers from OpenAlex:', url.toString());
    
    // Make API request
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Invalid response format from OpenAlex API');
    }
    
    console.log(`Found ${data.results.length} papers for query: "${query}"`);
    
    // Format and filter papers
    const formattedPapers = data.results
      .map(formatPaper)
      .filter(paper => paper !== null) // Remove failed parsing attempts
      .filter(paper => paper.title && paper.title !== 'Untitled'); // Ensure valid titles
    
    console.log(`Successfully formatted ${formattedPapers.length} papers`);
    
    return formattedPapers;
    
  } catch (error) {
    console.error('Error fetching papers from OpenAlex:', error);
    throw new Error(`Failed to fetch papers: ${error.message}`);
  }
}

/**
 * Fetch papers with additional filtering options
 * @param {string} query - Search query
 * @param {number} count - Number of papers to fetch
 * @param {Object} options - Additional filtering options
 * @returns {Promise<Array>} - Array of formatted paper objects
 */
async function fetch_openalex_papers_advanced(query, count = 50, options = {}) {
  const {
    yearFrom = 2000,
    yearTo = 2024,
    sortBy = 'cited_by_count:desc',
    includeOpenAccess = false,
    minCitations = 0
  } = options;
  
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  
  const limitedCount = Math.min(count, 200);
  
  try {
    const url = new URL(`${OPENALEX_BASE_URL}/works`);
    url.searchParams.set('search', query);
    url.searchParams.set('per-page', limitedCount.toString());
    url.searchParams.set('sort', sortBy);
    
    // Build filter string
    let filters = [`type:article`, `publication_year:${yearFrom}-${yearTo}`];
    
    if (includeOpenAccess) {
      filters.push('is_oa:true');
    }
    
    url.searchParams.set('filter', filters.join(','));
    
    console.log('Fetching papers with advanced options:', url.toString());
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Invalid response format from OpenAlex API');
    }
    
    // Format papers and apply additional filtering
    let formattedPapers = data.results
      .map(formatPaper)
      .filter(paper => paper !== null)
      .filter(paper => paper.title && paper.title !== 'Untitled');
    
    // Apply minimum citations filter
    if (minCitations > 0) {
      formattedPapers = formattedPapers.filter(paper => paper.citations >= minCitations);
    }
    
    console.log(`Successfully formatted ${formattedPapers.length} papers with advanced filtering`);
    
    return formattedPapers;
    
  } catch (error) {
    console.error('Error fetching papers with advanced options:', error);
    throw new Error(`Failed to fetch papers: ${error.message}`);
  }
}

/**
 * Test the utility function with sample queries
 */
async function testFetchFunction() {
  try {
    console.log('Testing fetch_openalex_papers utility...');
    
    // Test basic functionality
    const papers = await fetch_openalex_papers('machine learning', 5);
    
    console.log('Sample results:');
    papers.forEach((paper, index) => {
      console.log(`\n${index + 1}. ${paper.title}`);
      console.log(`   Year: ${paper.year}, Citations: ${paper.citations}`);
      console.log(`   Authors: ${paper.authors.map(a => a.name).join(', ')}`);
      console.log(`   Abstract: ${paper.abstract.substring(0, 100)}...`);
      console.log(`   Concepts: ${paper.concepts.slice(0, 3).map(c => c.name).join(', ')}`);
    });
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Classify a paper using Groq AI
 * @param {Object} paper - Paper object with title, abstract, and other metadata
 * @param {Array} branch_nodes - Array of available branch nodes with their subclusters
 * @param {string} groqApiKey - Groq API key for authentication
 * @param {number} maxRetries - Maximum number of retry attempts for invalid JSON
 * @returns {Promise<Object>} - Classification result with branch and subcluster
 */
async function classify_paper_with_groq(paper, branch_nodes, groqApiKey, maxRetries = 3) {
  // Validate inputs
  if (!paper || typeof paper !== 'object') {
    throw new Error('Paper must be a valid object');
  }
  
  if (!paper.title && !paper.abstract) {
    throw new Error('Paper must have at least a title or abstract');
  }
  
  if (!Array.isArray(branch_nodes) || branch_nodes.length === 0) {
    throw new Error('Branch nodes must be a non-empty array');
  }
  
  if (!groqApiKey || typeof groqApiKey !== 'string') {
    throw new Error('Groq API key is required');
  }
  
  // Prepare paper content for classification
  const paperContent = {
    title: paper.title || 'No title available',
    abstract: paper.abstract || 'No abstract available',
    concepts: paper.concepts ? paper.concepts.slice(0, 5).map(c => c.name).join(', ') : 'No concepts available',
    year: paper.year || 'Unknown year',
    authors: paper.authors ? paper.authors.slice(0, 3).map(a => a.name).join(', ') : 'Unknown authors'
  };
  
  // Extract branch information and existing subclusters
  const branchInfo = branch_nodes.map(branch => ({
    name: branch.name || branch.label || branch.id,
    subclusters: branch.subclusters || branch.children || []
  }));
  
  // Create the classification prompt
  const prompt = createClassificationPrompt(paperContent, branchInfo);
  
  let lastError;
  
  // Attempt classification with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting Groq classification (attempt ${attempt}/${maxRetries})...`);
      
      const response = await callGroqAPI(prompt, groqApiKey);
      const classification = parseGroqResponse(response);
      
      // Validate the classification result
      if (validateClassification(classification, branchInfo)) {
        console.log('✅ Successfully classified paper:', classification);
        return classification;
      } else {
        throw new Error('Invalid classification format or unknown branch/subcluster');
      }
      
    } catch (error) {
      lastError = error;
      console.warn(`❌ Classification attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('All classification attempts failed, falling back to default');
        return getFallbackClassification(paperContent, branchInfo);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw lastError;
}

/**
 * Create a detailed prompt for Groq AI classification
 * @param {Object} paperContent - Paper content to classify
 * @param {Array} branchInfo - Available branches and subclusters
 * @returns {string} - Formatted prompt for Groq AI
 */
function createClassificationPrompt(paperContent, branchInfo) {
  const branchDescriptions = branchInfo.map(branch => {
    const subclustersText = branch.subclusters.length > 0 
      ? `, existing subclusters: [${branch.subclusters.join(', ')}]`
      : ', no existing subclusters';
    
    return `- ${branch.name}${subclustersText}`;
  }).join('\n');
  
  return `You are an expert research paper classifier for engineering and computer science domains. 

TASK: Classify the following research paper into the most appropriate branch and subcluster.

PAPER TO CLASSIFY:
Title: "${paperContent.title}"
Abstract: "${paperContent.abstract.substring(0, 1000)}${paperContent.abstract.length > 1000 ? '...' : ''}"
Key Concepts: ${paperContent.concepts}
Year: ${paperContent.year}
Authors: ${paperContent.authors}

AVAILABLE BRANCHES:
${branchDescriptions}

INSTRUCTIONS:
1. Choose the most appropriate branch from the list above
2. Choose an existing subcluster OR create a new relevant subcluster name
3. Base your decision on the paper's title, abstract, and concepts
4. Be specific with subcluster names (e.g., "Machine Learning", "Signal Processing", "Structural Analysis")

REQUIRED OUTPUT FORMAT (JSON only):
{
  "branch": "exact_branch_name_from_list",
  "subcluster": "specific_subcluster_name",
  "confidence": 0.85,
  "reasoning": "brief explanation of classification decision"
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Call Groq AI API with the classification prompt
 * @param {string} prompt - The classification prompt
 * @param {string} apiKey - Groq API key
 * @returns {Promise<string>} - Raw response from Groq AI
 */
async function callGroqAPI(prompt, apiKey) {
  const requestBody = {
    model: 'llama3-8b-8192',
    messages: [
      {
        role: 'system',
        content: 'You are an expert research paper classifier. Always respond with valid JSON only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 500,
    top_p: 0.9
  };
  
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorData}`);
  }
  
  const responseData = await response.json();
  
  if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
    throw new Error('Invalid response format from Groq API');
  }
  
  return responseData.choices[0].message.content.trim();
}

/**
 * Parse and validate Groq AI response
 * @param {string} response - Raw response from Groq AI
 * @returns {Object} - Parsed classification object
 */
function parseGroqResponse(response) {
  try {
    // Try to extract JSON from the response
    let jsonText = response;
    
    // Look for JSON content between curly braces
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    // Parse the JSON
    const parsed = JSON.parse(jsonText);
    
    // Ensure required fields exist
    if (!parsed.branch || !parsed.subcluster) {
      throw new Error('Missing required fields: branch and subcluster');
    }
    
    return {
      branch: String(parsed.branch).trim(),
      subcluster: String(parsed.subcluster).trim(),
      confidence: Number(parsed.confidence) || 0.5,
      reasoning: String(parsed.reasoning || 'No reasoning provided').trim()
    };
    
  } catch (error) {
    console.error('Error parsing Groq response:', error);
    console.error('Raw response:', response);
    throw new Error(`Failed to parse Groq response: ${error.message}`);
  }
}

/**
 * Validate the classification result
 * @param {Object} classification - Classification result from Groq
 * @param {Array} branchInfo - Available branches and subclusters
 * @returns {boolean} - Whether the classification is valid
 */
function validateClassification(classification, branchInfo) {
  // Check if branch exists
  const validBranches = branchInfo.map(b => b.name.toLowerCase());
  const branchExists = validBranches.includes(classification.branch.toLowerCase());
  
  if (!branchExists) {
    console.warn(`Invalid branch: ${classification.branch}. Valid branches: ${validBranches.join(', ')}`);
    return false;
  }
  
  // Check if subcluster name is reasonable (not empty, not too long)
  if (!classification.subcluster || classification.subcluster.length < 2 || classification.subcluster.length > 100) {
    console.warn(`Invalid subcluster name: ${classification.subcluster}`);
    return false;
  }
  
  // Check confidence is within reasonable range
  if (classification.confidence < 0 || classification.confidence > 1) {
    console.warn(`Invalid confidence score: ${classification.confidence}`);
    classification.confidence = Math.max(0, Math.min(1, classification.confidence));
  }
  
  return true;
}

/**
 * Provide fallback classification when Groq AI fails
 * @param {Object} paperContent - Paper content
 * @param {Array} branchInfo - Available branches
 * @returns {Object} - Fallback classification
 */
function getFallbackClassification(paperContent, branchInfo) {
  console.log('Using fallback classification...');
  
  // Simple keyword-based classification
  const text = `${paperContent.title} ${paperContent.abstract} ${paperContent.concepts}`.toLowerCase();
  
  const keywordMap = {
    'CSE': ['computer', 'software', 'algorithm', 'programming', 'artificial intelligence', 'machine learning', 'data'],
    'ECE': ['electronics', 'communication', 'signal', 'wireless', 'circuit', 'embedded', 'antenna'],
    'EEE': ['electrical', 'power', 'energy', 'grid', 'motor', 'renewable', 'battery'],
    'Mechanical': ['mechanical', 'manufacturing', 'thermal', 'fluid', 'materials', 'automotive'],
    'Civil': ['civil', 'structural', 'construction', 'building', 'infrastructure', 'transportation']
  };
  
  let bestBranch = branchInfo[0].name; // Default to first branch
  let maxScore = 0;
  
  Object.entries(keywordMap).forEach(([branch, keywords]) => {
    const score = keywords.reduce((sum, keyword) => {
      return sum + (text.includes(keyword) ? 1 : 0);
    }, 0);
    
    if (score > maxScore) {
      maxScore = score;
      bestBranch = branch;
    }
  });
  
  return {
    branch: bestBranch,
    subcluster: 'General Research',
    confidence: Math.min(0.7, maxScore * 0.1 + 0.3),
    reasoning: 'Fallback keyword-based classification'
  };
}

/**
 * Test the Groq classification function
 * @param {string} groqApiKey - Groq API key for testing
 */
async function testGroqClassification(groqApiKey) {
  try {
    console.log('Testing Groq classification...');
    
    // Sample paper
    const testPaper = {
      title: 'Deep Learning for Medical Image Analysis',
      abstract: 'This paper presents a novel approach to medical image classification using convolutional neural networks and transfer learning techniques.',
      concepts: [
        { name: 'Machine learning', score: 0.9 },
        { name: 'Computer vision', score: 0.8 },
        { name: 'Medical imaging', score: 0.7 }
      ],
      year: 2023,
      authors: [{ name: 'John Doe' }, { name: 'Jane Smith' }]
    };
    
    // Sample branch nodes
    const testBranches = [
      { name: 'CSE', subclusters: ['Artificial Intelligence', 'Software Engineering'] },
      { name: 'ECE', subclusters: ['Signal Processing', 'Communications'] },
      { name: 'EEE', subclusters: ['Power Systems', 'Control Systems'] },
      { name: 'Mechanical', subclusters: ['Manufacturing', 'Thermodynamics'] },
      { name: 'Civil', subclusters: ['Structural Engineering', 'Transportation'] }
    ];
    
    const result = await classify_paper_with_groq(testPaper, testBranches, groqApiKey);
    
    console.log('✅ Classification result:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Groq classification test failed:', error);
    throw error;
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetch_openalex_papers,
    fetch_openalex_papers_advanced,
    classify_paper_with_groq,
    reconstructAbstract,
    formatPaper,
    testFetchFunction,
    testGroqClassification,
    createClassificationPrompt,
    parseGroqResponse,
    validateClassification,
    getFallbackClassification
  };
}

// For browser environments
if (typeof window !== 'undefined') {
  window.fetch_openalex_papers = fetch_openalex_papers;
  window.fetch_openalex_papers_advanced = fetch_openalex_papers_advanced;
  window.classify_paper_with_groq = classify_paper_with_groq;
  window.testOpenAlexFetch = testFetchFunction;
  window.testGroqClassification = testGroqClassification;
}
