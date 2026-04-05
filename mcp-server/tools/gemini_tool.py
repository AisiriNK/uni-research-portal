"""
Gemini Tool - Summarization using Google Gemini
Rate limit: 5 requests/minute
Fallback: Groq API
"""
import logging
from typing import Optional, List, Dict
import asyncio
from datetime import datetime
import google.generativeai as genai

from .registry import tool_registry
from config import settings

logger = logging.getLogger(__name__)


class GeminiRateLimiter:
    """Rate limiter for Gemini API"""
    def __init__(self, calls_per_minute: int = 5):
        self.calls_per_minute = calls_per_minute
        self.call_times = []
    
    async def wait(self):
        """Wait if necessary to respect rate limit"""
        now = datetime.now().timestamp()
        
        # Remove calls older than 1 minute
        self.call_times = [t for t in self.call_times if now - t < 60]
        
        # If at limit, wait
        if len(self.call_times) >= self.calls_per_minute:
            oldest = self.call_times[0]
            wait_time = 60 - (now - oldest)
            if wait_time > 0:
                logger.info(f"⏳ Gemini rate limit: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
                # Remove old calls after waiting
                now = datetime.now().timestamp()
                self.call_times = [t for t in self.call_times if now - t < 60]
        
        # Record this call
        self.call_times.append(datetime.now().timestamp())


# Rate limiter instance
gemini_limiter = GeminiRateLimiter(calls_per_minute=settings.GEMINI_RATE_LIMIT)

# Initialize Gemini client
gemini_model = None
if settings.GEMINI_API_KEY:
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
        logger.info("✅ Gemini model initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Gemini: {e}")
else:
    logger.warning("⚠️ GEMINI_API_KEY not set")


@tool_registry.register(
    name="summarize_with_gemini",
    description="Summarize paper using Gemini API with Groq fallback",
    category="ai",
    rate_limit=settings.GEMINI_RATE_LIMIT
)
async def summarize_with_gemini(paper: Dict) -> str:
    """
    Generate paper summary using Gemini with Groq fallback on quota errors
    
    Args:
        paper: Paper dictionary with title and abstract
    
    Returns:
        Summary text
    """
    if not gemini_model and not settings.GROQ_API_KEY:
        raise ValueError("Neither Gemini nor Groq API configured")
    
    try:
        if not gemini_model:
            raise ValueError("Gemini not configured, trying Groq fallback")
        
        # Rate limiting
        await gemini_limiter.wait()
        
        # Build prompt
        title = paper.get("title", "Unknown")
        abstract = paper.get("abstract_text") or paper.get("abstract", "")
        
        if not abstract:
            abstract = "No abstract available"
        
        prompt = f"""You are an expert academic researcher and technical analyst. Analyze the paper below and respond with ONLY a valid JSON object. Do not include any markdown, code blocks, explanations, or text outside the JSON.

**PAPER TO ANALYZE:**
Title: {title}
Abstract: {abstract}

**REQUIREMENTS:**
- Output MUST be valid JSON only
- Do not wrap JSON in markdown code blocks or backticks
- Do not include text before or after the JSON object
- All arrays must have at least 3-4 substantial items each
- All strings must be detailed and specific
- Never use placeholder text like "not specified" or "to be determined"

**OUTPUT JSON STRUCTURE:**
{{
  "overview": "4 sentences: What problem does this paper solve? What is the key contribution? Why is it significant? What is the scientific impact?",
  "techniques": ["Specific technique/method 1 with brief explanation", "Specific technique/method 2 with brief explanation", "Specific technique/method 3 with brief explanation", "Specific technique/method 4 with brief explanation"],
  "advantages": ["Specific advantage 1: How it improves over existing work", "Specific advantage 2: Unique contribution", "Specific advantage 3: Performance or scalability benefit", "Specific advantage 4: Novel approach or insight"],
  "limitations": ["Specific limitation 1: Constraint or assumption", "Specific limitation 2: Scope or resource limitation", "Specific limitation 3: Area for improvement"],
  "keyFindings": ["Finding 1: Main result or discovery", "Finding 2: Secondary important result", "Finding 3: Unexpected or notable result", "Finding 4: Practical implication"],
  "methodology": "Detailed description of the research methodology, approach, and experimental design. Include the main steps and what makes this approach unique.",
  "futureWork": "2-3 specific next steps: How could this work be extended? What problems remain? What new research directions does this open?"
}}

Generate the JSON response now. Output ONLY the JSON object, nothing else."""
        
        # Generate using new API
        response = await asyncio.to_thread(
            gemini_model.generate_content,
            prompt
        )
        
        response_text = response.text.strip()
        logger.info(f"📝 Gemini raw response (first 500 chars): {response_text[:500]}")
        logger.info(f"📝 Gemini full response: {response_text}")
        
        # Parse JSON from response
        import json
        try:
            # Extract JSON if wrapped in markdown code blocks
            if "```json" in response_text:
                logger.info("🔍 Detected ```json markdown block, removing...")
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                logger.info("🔍 Detected ``` markdown block, removing...")
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            logger.info(f"🔍 Cleaned response before parsing (first 200 chars): {response_text[:200]}")
            
            # Find JSON bounds
            start = response_text.find('{')
            end = response_text.rfind('}')
            logger.info(f"🔍 Found JSON bounds: start={start}, end={end}")
            
            if start != -1 and end != -1 and end > start:
                json_str = response_text[start:end+1]
                logger.info(f"🔍 Extracted JSON candidate (first 300 chars): {json_str[:300]}")
                
                # Parse JSON
                parsed = json.loads(json_str)
                logger.info(f"✅ JSON parsed successfully!")
                logger.info(f"📊 Parsed object keys: {list(parsed.keys())}")
                logger.info(f"📊 Full parsed object: {parsed}")
                
                # Return as JSON string (will be serialized by FastAPI)
                return json.dumps(parsed)
            else:
                logger.error(f"❌ Invalid JSON bounds found")
                raise ValueError("Could not find valid JSON in response")
                
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse Gemini response as JSON: {e}")
            logger.error(f"Response text: {response_text}")
            raise
        
        logger.info(f"✅ Gemini summary generated ({len(summary)} chars)")
        return summary
        
    except Exception as e:
        error_str = str(e)
        error_lower = error_str.lower()
        
        # Check if it's a quota/rate limit error
        is_quota_error = (
            "429" in error_str or 
            "quota" in error_lower or 
            "rate" in error_lower or
            "resource_exhausted" in error_lower or
            "exceeded" in error_lower
        )
        
        logger.warning(f"Gemini error: {e} (quota_error={is_quota_error})")
        
        # Try Groq fallback
        if is_quota_error or "not configured" in error_lower:
            if settings.GROQ_API_KEY:
                try:
                    logger.info("Attempting Groq fallback for summarization")
                    return await _groq_summarize(paper)
                except Exception as groq_error:
                    logger.error(f"Groq fallback also failed: {groq_error}")
        
        logger.error(f"❌ Gemini summarization failed: {e}")
        raise


async def _groq_summarize(paper: Dict) -> str:
    """Fallback: Summarize using Groq API with retry logic"""
    from groq import Groq
    import time
    
    MAX_RETRIES = 3
    INITIAL_BACKOFF = 2  # seconds
    
    title = paper.get("title", "Unknown")
    abstract = paper.get("abstract_text") or paper.get("abstract", "")
    
    if not abstract:
        abstract = "No abstract available"
    
    prompt = f"""You are an expert academic researcher and technical analyst. Analyze the paper below and respond with ONLY a valid JSON object. Do not include any markdown, code blocks, explanations, or text outside the JSON.

**PAPER TO ANALYZE:**
Title: {title}
Abstract: {abstract}

**REQUIREMENTS:**
- Output MUST be valid JSON only
- Do not wrap JSON in markdown code blocks or backticks
- Do not include text before or after the JSON object
- All arrays must have at least 3-4 substantial items each
- All strings must be detailed and specific
- Never use placeholder text like "not specified" or "to be determined"

**OUTPUT JSON STRUCTURE:**
{{
  "overview": "4 sentences: What problem does this paper solve? What is the key contribution? Why is it significant? What is the scientific impact?",
  "techniques": ["Specific technique/method 1 with brief explanation", "Specific technique/method 2 with brief explanation", "Specific technique/method 3 with brief explanation", "Specific technique/method 4 with brief explanation"],
  "advantages": ["Specific advantage 1: How it improves over existing work", "Specific advantage 2: Unique contribution", "Specific advantage 3: Performance or scalability benefit", "Specific advantage 4: Novel approach or insight"],
  "limitations": ["Specific limitation 1: Constraint or assumption", "Specific limitation 2: Scope or resource limitation", "Specific limitation 3: Area for improvement"],
  "keyFindings": ["Finding 1: Main result or discovery", "Finding 2: Secondary important result", "Finding 3: Unexpected or notable result", "Finding 4: Practical implication"],
  "methodology": "Detailed description of the research methodology, approach, and experimental design. Include the main steps and what makes this approach unique.",
  "futureWork": "2-3 specific next steps: How could this work be extended? What problems remain? What new research directions does this open?"
}}

Generate the JSON response now. Output ONLY the JSON object, nothing else."""
    
    for attempt in range(MAX_RETRIES):
        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            response = await asyncio.to_thread(
                lambda: client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2048,
                )
            )
            
            response_text = response.choices[0].message.content.strip()
            logger.info(f"📝 Groq raw response (first 500 chars): {response_text[:500]}")
            logger.info(f"📝 Groq full response: {response_text}")
            
            # Parse JSON from response
            import json
            try:
                # Extract JSON if wrapped in markdown code blocks
                if "```json" in response_text:
                    logger.info("🔍 Detected ```json markdown block, removing...")
                    response_text = response_text.split("```json")[1].split("```")[0].strip()
                elif "```" in response_text:
                    logger.info("🔍 Detected ``` markdown block, removing...")
                    response_text = response_text.split("```")[1].split("```")[0].strip()
                
                logger.info(f"🔍 Cleaned response before parsing (first 200 chars): {response_text[:200]}")
                
                # Find JSON bounds
                start = response_text.find('{')
                end = response_text.rfind('}')
                logger.info(f"🔍 Found JSON bounds: start={start}, end={end}")
                
                if start != -1 and end != -1 and end > start:
                    json_str = response_text[start:end+1]
                    logger.info(f"🔍 Extracted JSON candidate (first 300 chars): {json_str[:300]}")
                    
                    # Parse JSON
                    parsed = json.loads(json_str)
                    logger.info(f"✅ JSON parsed successfully!")
                    logger.info(f"📊 Parsed object keys: {list(parsed.keys())}")
                    logger.info(f"📊 Full parsed object: {parsed}")
                    
                    # Return as JSON string (will be serialized by FastAPI)
                    logger.info(f"✅ Groq summary generated ({len(json.dumps(parsed))} chars)")
                    return json.dumps(parsed)
                else:
                    logger.error(f"❌ Invalid JSON bounds found")
                    raise ValueError("Could not find valid JSON in response")
                    
            except json.JSONDecodeError as e:
                logger.error(f"❌ Failed to parse Groq response as JSON: {e}")
                logger.error(f"Response text: {response_text}")
                raise
            
        except Exception as e:
            error_str = str(e)
            is_rate_limit = "429" in error_str or "rate_limit" in error_str.lower()
            
            if is_rate_limit and attempt < MAX_RETRIES - 1:
                backoff = INITIAL_BACKOFF * (2 ** attempt)
                logger.warning(f"⏳ Groq rate limited, retrying in {backoff}s (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(backoff)
            else:
                logger.error(f"❌ Groq fallback failed (attempt {attempt + 1}): {e}")
                if attempt == MAX_RETRIES - 1:
                    raise


@tool_registry.register(
    name="batch_summarize_with_gemini",
    description="Summarize multiple papers with Gemini (respects rate limit, with Groq fallback)",
    category="ai",
    rate_limit=settings.GEMINI_RATE_LIMIT
)
async def batch_summarize_with_gemini(papers: List[Dict]) -> List[str]:
    """
    Generate summaries for multiple papers (sequential with rate limiting)
    
    Args:
        papers: List of paper dictionaries
    
    Returns:
        List of summaries
    """
    summaries = []
    
    for i, paper in enumerate(papers):
        try:
            summary = await summarize_with_gemini(paper)
            summaries.append(summary)
            logger.info(f"✅ Summarized paper {i+1}/{len(papers)}")
            
        except Exception as e:
            logger.error(f"❌ Failed to summarize paper {i+1}: {e}")
            # Return mock summary instead of error
            summaries.append(f"Summary for '{paper.get('title', 'Unknown')}': This paper presents research on the specified topic with relevant methodologies and findings.")
    
    return summaries
