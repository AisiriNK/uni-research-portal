"""
Groq Tool - Research gap analysis using Groq API
Rate limit: 10 requests/minute
"""
import logging
from typing import List, Dict
import asyncio
from datetime import datetime
from groq import AsyncGroq

from .registry import tool_registry
from config import settings

logger = logging.getLogger(__name__)


class GroqRateLimiter:
    """Rate limiter for Groq API"""
    def __init__(self, calls_per_minute: int = 10):
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
                logger.info(f"⏳ Groq rate limit: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
                # Remove old calls after waiting
                now = datetime.now().timestamp()
                self.call_times = [t for t in self.call_times if now - t < 60]
        
        # Record this call
        self.call_times.append(datetime.now().timestamp())


# Rate limiter instance
groq_limiter = GroqRateLimiter(calls_per_minute=settings.GROQ_RATE_LIMIT)

# Initialize Groq client
groq_client = None
if settings.GROQ_API_KEY:
    groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
else:
    logger.warning("⚠️ GROQ_API_KEY not set")


@tool_registry.register(
    name="find_gaps_with_groq",
    description="Identify research gaps using Groq API",
    category="ai",
    rate_limit=settings.GROQ_RATE_LIMIT
)
async def find_gaps_with_groq(paper_summary: str, context: str = "") -> List[str]:
    """
    Identify research gaps from paper summary
    
    Args:
        paper_summary: Paper summary text
        context: Optional research context
    
    Returns:
        List of research gaps
    """
    if not groq_client:
        raise ValueError("Groq API not configured")
    
    try:
        # Rate limiting
        await groq_limiter.wait()
        
        # Build prompt
        prompt = f"""Analyze this research paper and identify specific research gaps:

Paper Summary:
{paper_summary}

{f"Research Context: {context}" if context else ""}

Identify 3-5 specific research gaps, limitations, or future research directions. For each gap:
1. Be specific and actionable
2. Explain why it's significant
3. Suggest potential approaches

Format as a numbered list.

Research Gaps:"""
        
        # Generate
        response = await groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {
                    "role": "system",
                    "content": "You are a research analyst identifying gaps in academic papers."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        gaps_text = response.choices[0].message.content.strip()
        
        # Parse into list
        gaps = []
        for line in gaps_text.split('\n'):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-') or line.startswith('*')):
                # Remove numbering/bullets
                gap = line.lstrip('0123456789.-*) ').strip()
                if gap:
                    gaps.append(gap)
        
        logger.info(f"✅ Groq identified {len(gaps)} research gaps")
        return gaps
        
    except Exception as e:
        logger.error(f"❌ Groq gap analysis failed: {e}")
        raise


@tool_registry.register(
    name="summarize_with_groq",
    description="Summarize paper using Groq (Gemini fallback)",
    category="ai",
    rate_limit=settings.GROQ_RATE_LIMIT
)
async def summarize_with_groq(paper: Dict) -> str:
    """
    Generate paper summary using Groq (fallback for Gemini)
    
    Args:
        paper: Paper dictionary
    
    Returns:
        Summary text
    """
    if not groq_client:
        raise ValueError("Groq API not configured")
    
    try:
        # Rate limiting
        await groq_limiter.wait()
        
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
        response = await groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {
                    "role": "system",
                    "content": "You are a research assistant summarizing academic papers."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.5,
            max_tokens=500
        )
        
        summary = response.choices[0].message.content.strip()
        
        logger.info(f"✅ Groq summary generated ({len(summary)} chars)")
        return summary
        
    except Exception as e:
        logger.error(f"❌ Groq summarization failed: {e}")
        raise
