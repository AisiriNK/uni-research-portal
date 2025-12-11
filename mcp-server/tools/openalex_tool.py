"""
OpenAlex Tool - Fetch papers from OpenAlex API
Rate limit: 10 requests/second
"""
import httpx
import logging
from typing import List, Dict, Optional
import asyncio

from .registry import tool_registry
from config import settings

logger = logging.getLogger(__name__)

OPENALEX_BASE_URL = "https://api.openalex.org"


class RateLimiter:
    """Simple rate limiter"""
    def __init__(self, calls_per_second: int = 10):
        self.calls_per_second = calls_per_second
        self.min_interval = 1.0 / calls_per_second
        self.last_call = 0
    
    async def wait(self):
        """Wait if necessary to respect rate limit"""
        now = asyncio.get_event_loop().time()
        time_since_last = now - self.last_call
        if time_since_last < self.min_interval:
            await asyncio.sleep(self.min_interval - time_since_last)
        self.last_call = asyncio.get_event_loop().time()


# Rate limiter instance
openalex_limiter = RateLimiter(calls_per_second=settings.OPENALEX_RATE_LIMIT)


@tool_registry.register(
    name="fetch_papers",
    description="Fetch papers from OpenAlex API with pagination",
    category="data_fetching",
    rate_limit=settings.OPENALEX_RATE_LIMIT * 60  # per minute
)
async def fetch_papers(
    query: str,
    limit: int = 50,
    filters: Optional[Dict] = None
) -> List[Dict]:
    """
    Fetch papers from OpenAlex
    
    Args:
        query: Search query
        limit: Maximum number of papers
        filters: Additional filters (e.g., year range)
    
    Returns:
        List of paper dictionaries
    """
    papers = []
    page = 1
    per_page = min(25, limit)  # OpenAlex max per page
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            while len(papers) < limit:
                # Rate limiting
                await openalex_limiter.wait()
                
                # Build request
                params = {
                    "search": query,
                    "per-page": per_page,
                    "page": page,
                    "mailto": "research@university.edu"  # Polite pool
                }
                
                # Add filters
                if filters:
                    if filters.get("from_year"):
                        params["filter"] = f"publication_year:{filters['from_year']}-{filters.get('to_year', 2024)}"
                
                # Make request
                response = await client.get(
                    f"{OPENALEX_BASE_URL}/works",
                    params=params
                )
                
                if response.status_code != 200:
                    logger.error(f"OpenAlex API error: {response.status_code}")
                    break
                
                data = response.json()
                results = data.get("results", [])
                
                if not results:
                    break
                
                # Parse papers
                for work in results:
                    paper = parse_openalex_work(work)
                    papers.append(paper)
                    
                    if len(papers) >= limit:
                        break
                
                # Check if more pages available
                if len(results) < per_page:
                    break
                
                page += 1
        
        logger.info(f"✅ Fetched {len(papers)} papers from OpenAlex")
        return papers[:limit]
        
    except Exception as e:
        logger.error(f"❌ OpenAlex fetch failed: {e}")
        raise


def parse_openalex_work(work: Dict) -> Dict:
    """Parse OpenAlex work into standard paper format"""
    try:
        # Extract authors
        authors = []
        for authorship in work.get("authorships", []):
            author = authorship.get("author", {})
            authors.append({
                "name": author.get("display_name", "Unknown"),
                "id": author.get("id", "")
            })
        
        # Extract publication info
        host_venue = work.get("primary_location", {}) or {}
        venue = host_venue.get("source", {})
        
        return {
            "paper_id": work["id"].split("/")[-1],  # Extract ID from URL
            "title": work.get("display_name", "Untitled"),
            "abstract": work.get("abstract_inverted_index"),  # Need to reconstruct
            "abstract_text": reconstruct_abstract(work.get("abstract_inverted_index")),
            "authors": authors,
            "year": work.get("publication_year"),
            "doi": work.get("doi"),
            "citation_count": work.get("cited_by_count", 0),
            "venue": venue.get("display_name", "Unknown"),
            "url": work.get("id"),
            "pdf_url": host_venue.get("pdf_url"),
            "open_access": work.get("open_access", {}).get("is_oa", False),
            "concepts": [
                {
                    "name": c["display_name"],
                    "score": c.get("score", 0)
                }
                for c in work.get("concepts", [])[:5]
            ]
        }
        
    except Exception as e:
        logger.error(f"Error parsing OpenAlex work: {e}")
        return {
            "paper_id": work.get("id", "unknown"),
            "title": work.get("display_name", "Unknown"),
            "error": str(e)
        }


def reconstruct_abstract(inverted_index: Optional[Dict]) -> str:
    """Reconstruct abstract from inverted index"""
    if not inverted_index:
        return ""
    
    try:
        # Create list of (position, word) tuples
        words = []
        for word, positions in inverted_index.items():
            for pos in positions:
                words.append((pos, word))
        
        # Sort by position and join
        words.sort(key=lambda x: x[0])
        return " ".join(word for _, word in words)
        
    except Exception as e:
        logger.error(f"Error reconstructing abstract: {e}")
        return ""


@tool_registry.register(
    name="get_paper_details",
    description="Get detailed information for a specific paper",
    category="data_fetching"
)
async def get_paper_details(paper_id: str) -> Dict:
    """
    Get detailed paper information from OpenAlex
    
    Args:
        paper_id: OpenAlex paper ID
    
    Returns:
        Detailed paper dictionary
    """
    try:
        await openalex_limiter.wait()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{OPENALEX_BASE_URL}/works/{paper_id}",
                params={"mailto": "research@university.edu"}
            )
            
            if response.status_code != 200:
                raise ValueError(f"OpenAlex API error: {response.status_code}")
            
            work = response.json()
            return parse_openalex_work(work)
            
    except Exception as e:
        logger.error(f"❌ Failed to get paper details: {e}")
        raise
