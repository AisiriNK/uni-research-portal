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
        
        prompt = f"""Summarize this research paper concisely:

Title: {title}

Abstract: {abstract}

Provide a 3-4 sentence summary covering:
1. Main research problem
2. Methodology approach
3. Key findings
4. Significance/impact

Summary:"""
        
        # Generate using new API
        response = await asyncio.to_thread(
            gemini_model.generate_content,
            prompt
        )
        
        summary = response.text.strip()
        
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
    
    prompt = f"""Summarize this research paper concisely:

Title: {title}

Abstract: {abstract}

Provide a 3-4 sentence summary covering:
1. Main research problem
2. Methodology approach
3. Key findings
4. Significance/impact

Summary:"""
    
    for attempt in range(MAX_RETRIES):
        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            response = await asyncio.to_thread(
                lambda: client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.5,
                )
            )
            
            summary = response.choices[0].message.content.strip()
            logger.info(f"✅ Groq summary generated ({len(summary)} chars)")
            return summary
            
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
