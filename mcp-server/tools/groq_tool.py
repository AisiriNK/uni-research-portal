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
        
        # Generate
        response = await groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert academic researcher. Return ONLY valid JSON, no markdown, no explanations."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=2048
        )
        
        response_text = response.choices[0].message.content.strip()
        
        logger.info(f"Groq raw response (first 500 chars): {response_text[:500]}")
        logger.info(f"Groq full response: {response_text}")
        
        # Try to parse JSON from response
        import json
        try:
            # Extract JSON if wrapped in markdown code blocks
            if "```json" in response_text:
                logger.info("Detected ```json markdown block, removing...")
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                logger.info("Detected ``` markdown block, removing...")
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            logger.info(f"Cleaned response before parsing: {response_text[:500]}")
            parsed = json.loads(response_text)
            logger.info(f"✅ Successfully parsed Groq JSON response")
            logger.info(f"Parsed object keys: {list(parsed.keys())}")
            
            # Return as JSON string for consistency with storage
            summary = json.dumps(parsed)
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse Groq response as JSON: {e}")
            logger.error(f"Response text: {response_text}")
            # Fallback: return as plain text wrapped in basic structure
            summary = json.dumps({
                "overview": response_text,
                "techniques": ["Advanced research methodology"],
                "advantages": ["Contributes to scientific knowledge"],
                "limitations": ["Further research needed"],
                "keyFindings": ["Research findings"],
                "methodology": response_text,
                "futureWork": "Future research directions"
            })
        
        logger.info(f"✅ Groq summary generated ({len(summary)} chars)")
        return summary
        
    except Exception as e:
        logger.error(f"❌ Groq summarization failed: {e}")
        raise
