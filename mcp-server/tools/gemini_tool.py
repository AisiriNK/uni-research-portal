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

# Initialize Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-pro')
else:
    gemini_model = None
    logger.warning("⚠️ GEMINI_API_KEY not set")


@tool_registry.register(
    name="summarize_with_gemini",
    description="Summarize paper using Gemini API",
    category="ai",
    rate_limit=settings.GEMINI_RATE_LIMIT
)
async def summarize_with_gemini(paper: Dict) -> str:
    """
    Generate paper summary using Gemini
    
    Args:
        paper: Paper dictionary with title and abstract
    
    Returns:
        Summary text
    """
    if not gemini_model:
        raise ValueError("Gemini API not configured")
    
    try:
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
        
        # Generate
        response = await asyncio.to_thread(
            gemini_model.generate_content,
            prompt
        )
        
        summary = response.text.strip()
        
        logger.info(f"✅ Gemini summary generated ({len(summary)} chars)")
        return summary
        
    except Exception as e:
        logger.error(f"❌ Gemini summarization failed: {e}")
        raise


@tool_registry.register(
    name="batch_summarize_with_gemini",
    description="Summarize multiple papers with Gemini (respects rate limit)",
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
            summaries.append(f"Error: {str(e)}")
    
    return summaries
