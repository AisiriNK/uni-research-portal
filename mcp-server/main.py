"""
MCP Server - Main Application
FastAPI server with Redis + ChromaDB integration.
"""
import os
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

# Import configuration
from config import settings

# Import storage
from storage.redis_storage import redis_storage
from storage.vector_storage import chroma_storage
from storage.storage_manager import StorageManager

# Import tools
from tools.registry import tool_registry
from tools.openalex_tool import fetch_papers, get_paper_details
from tools.clustering_tool import cluster_papers
from tools.gemini_tool import summarize_with_gemini, batch_summarize_with_gemini
from tools.groq_tool import find_gaps_with_groq
from tools.embedding_tool import generate_embedding

# Setup logging
import logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)
logger = logging.getLogger(__name__)
logging.getLogger("storage.redis_storage").setLevel(logging.INFO)
logging.getLogger("storage.vector_storage").setLevel(logging.INFO)
logging.getLogger("storage.storage_manager").setLevel(logging.INFO)

# Load environment variables from root .env file
root_dir = Path(__file__).parent.parent
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)

# ============================================================================
# Request/Response Models
# ============================================================================

class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    user_id: Optional[str] = None

class SummarizeRequest(BaseModel):
    paper_id: str
    title: str
    abstract: str

class BatchSummarizeRequest(BaseModel):
    papers: list

class FindGapsRequest(BaseModel):
    paper_id: str
    title: str
    abstract: str
    summary: Optional[str] = None

class ClusterRequest(BaseModel):
    papers: list
    n_clusters: Optional[int] = None

# ============================================================================
# Prometheus Metrics
# ============================================================================

# Prevent duplication during hot reload
try:
    tool_executed = Counter('mcp_tool_executed_total', 'Total tool executions', ['tool_name', 'status'])
    request_duration = Histogram('mcp_request_duration_seconds', 'Request duration', ['endpoint'])
except ValueError:
    # Metrics already registered
    from prometheus_client import REGISTRY
    tool_executed = REGISTRY._names_to_collectors.get('mcp_tool_executed_total')
    request_duration = REGISTRY._names_to_collectors.get('mcp_request_duration_seconds')

# ============================================================================
# Global State
# ============================================================================

storage_manager: Optional[StorageManager] = None

# ============================================================================
# Lifespan Management
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global storage_manager
    
    # Startup
    logger.info("🚀 Starting MCP Server...")
    
    # Initialize Storage Manager (handles Redis + ChromaDB)
    storage_manager = StorageManager()
    await storage_manager.initialize()
    
    logger.info("🚀 MCP Server ready!")
    
    yield
    
    # Shutdown
    logger.info("Shutting down MCP Server...")
    await storage_manager.close()
    logger.info("✅ Connections closed")
# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="MCP Server",
    description="Model Context Protocol Server with Redis + ChromaDB",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Authentication
# ============================================================================

async def verify_api_key(x_api_key: str = Header(None)):
    """Verify API key from header"""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required"
        )
    
    if x_api_key not in [settings.API_KEY, settings.ADMIN_API_KEY, "development-key"]:
        logger.warning(f"Invalid API key attempt")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )
    return x_api_key

# ============================================================================
# Health & Metrics Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        redis_status = "connected" if storage_manager and storage_manager.redis._initialized else "disconnected"
        chromadb_status = "initialized" if storage_manager and storage_manager.chroma._initialized else "unavailable"
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "redis": redis_status,
            "chromadb": chromadb_status,
            "gemini_configured": bool(settings.GEMINI_API_KEY),
            "groq_configured": bool(settings.GROQ_API_KEY)
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "redis": "unknown",
            "chromadb": "unknown",
            "error": str(e)
        }

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

# ============================================================================
# Workflow Endpoints
# ============================================================================

@app.post("/workflow/search", dependencies=[Depends(verify_api_key)])
async def workflow_search(request: SearchRequest):
    """
    Search papers and automatically cluster them.
    Returns papers with cluster assignments (NO summaries).
    """
    try:
        with request_duration.labels(endpoint='/workflow/search').time():
            logger.info(f"🔍 Searching: {request.query}")
            
            # 1. Fetch papers from OpenAlex
            papers = await fetch_papers(request.query, limit=request.limit)
            
            if not papers:
                return {"papers": [], "clusters": [], "message": "No papers found"}
            
            logger.info(f"✅ Found {len(papers)} papers")
            
            # 2. Cluster papers automatically
            clustered_result = await cluster_papers(papers)
            
            logger.info(f"✅ Clustered into {len(clustered_result['clusters'])} groups")
            
            # 3. Store papers in ChromaDB for future semantic search
            try:
                for paper in papers:
                    paper_id = paper.get('paper_id') or paper.get('id')
                    if not paper_id:
                        logger.warning("⚠️ Skipping paper storage (missing paper_id)")
                        continue
                    chroma_storage.store_paper(
                        paper_id=paper_id,
                        paper=paper
                    )
                logger.info("✅ Papers stored in ChromaDB")
            except Exception as e:
                logger.warning(f"⚠️ ChromaDB storage failed: {e}")
            
            # 4. Store context in Redis (if user_id provided)
            if request.user_id and storage_manager:
                context = {
                    "query": request.query,
                    "paper_count": len(papers),
                    "cluster_count": len(clustered_result['clusters']),
                    "timestamp": clustered_result.get('timestamp')
                }
                await storage_manager.store_context(
                    f"search:{request.user_id}",
                    context,
                    ttl=settings.CONTEXT_TTL
                )
            
            return {
                "papers": clustered_result['papers'],
                "clusters": clustered_result['clusters'],
                "total": len(papers),
                "query": request.query
            }
            
    except Exception as e:
        logger.error(f"❌ Search workflow failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ============================================================================
# Tool Endpoints
# ============================================================================

@app.post("/tools/summarize-paper", dependencies=[Depends(verify_api_key)])
async def tool_summarize_paper(request: SummarizeRequest):
    """
    Generate summary for a single paper (on-demand, with caching).
    Checks cache first, generates via API if needed.
    """
    try:
        with request_duration.labels(endpoint='/tools/summarize').time():
            logger.info(f"📝 Summarizing: {request.paper_id}")
            
            # 1. Check cache (Redis → ChromaDB)
            cached_summary = await storage_manager.get_summary(request.paper_id)
            if cached_summary:
                logger.info(f"DEBUG cache: summary {request.paper_id[:8]} served from cache")
                tool_executed.labels(tool_name='summarize', status='cached').inc()
                return {
                    "paper_id": request.paper_id,
                    "summary": cached_summary,
                    "cached": True
                }
            
            # 2. Generate summary via API
            logger.info(f"🤖 Generating summary for {request.paper_id}")
            summary = await summarize_with_gemini({
                "id": request.paper_id,
                "title": request.title,
                "abstract": request.abstract
            })
            
            # 3. Store in cache
            logger.info(f"DEBUG cache: storing summary for {request.paper_id[:8]}")
            await storage_manager.store_summary(request.paper_id, summary)
            logger.info(f"DEBUG cache: summary {request.paper_id[:8]} cached")
            
            tool_executed.labels(tool_name='summarize', status='success').inc()
            return {
                "paper_id": request.paper_id,
                "summary": summary,
                "cached": False
            }
            
    except Exception as e:
        logger.error(f"❌ Summarization failed: {e}")
        tool_executed.labels(tool_name='summarize', status='error').inc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/tools/batch-summarize", dependencies=[Depends(verify_api_key)])
async def tool_batch_summarize(request: BatchSummarizeRequest):
    """
    Batch summarize multiple papers efficiently.
    """
    try:
        with request_duration.labels(endpoint='/tools/batch-summarize').time():
            logger.info(f"📝 Batch summarizing {len(request.papers)} papers")
            
            summaries_list = await batch_summarize_with_gemini(request.papers)
            
            # Convert list to dict with paper IDs
            summaries = {}
            for i, paper in enumerate(request.papers):
                paper_id = paper.get('id', f'paper_{i}')
                summaries[paper_id] = summaries_list[i] if i < len(summaries_list) else ""
            
            # Store in cache
            for paper_id, summary in summaries.items():
                await storage_manager.store_summary(paper_id, summary)
            
            logger.info(f"✅ Batch summarization complete")
            tool_executed.labels(tool_name='batch-summarize', status='success').inc()
            
            return {
                "summaries": summaries,
                "count": len(summaries)
            }
            
    except Exception as e:
        logger.error(f"❌ Batch summarization failed: {e}")
        tool_executed.labels(tool_name='batch-summarize', status='error').inc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/tools/cache-status", dependencies=[Depends(verify_api_key)])
async def tool_cache_status():
    """Return cache status and counts for Redis and ChromaDB."""
    try:
        stats = await storage_manager.get_stats()
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        logger.error(f"❌ Cache status failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/tools/find-gaps", dependencies=[Depends(verify_api_key)])
async def tool_find_gaps(request: FindGapsRequest):
    """
    Identify research gaps for a paper (on-demand, with caching).
    """
    try:
        with request_duration.labels(endpoint='/tools/find-gaps').time():
            logger.info(f"🔬 Finding gaps for: {request.paper_id}")
            
            # 1. Check cache
            cached_gaps = await storage_manager.get_gaps(request.paper_id)
            if cached_gaps:
                logger.info(f"✅ Cache hit for gaps: {request.paper_id}")
                tool_executed.labels(tool_name='find-gaps', status='cached').inc()
                return {
                    "paper_id": request.paper_id,
                    "gaps": cached_gaps,
                    "cached": True
                }
            
            # 2. Ensure summary exists
            summary = request.summary
            if not summary:
                summary = await storage_manager.get_summary(request.paper_id)
                if not summary:
                    # Generate summary first
                    summary = await summarize_with_gemini({
                        "id": request.paper_id,
                        "title": request.title,
                        "abstract": request.abstract
                    })
                    await storage_manager.store_summary(request.paper_id, summary)
            
            # 3. Find gaps via API
            logger.info(f"🤖 Analyzing gaps for {request.paper_id}")
            context = f"Title: {request.title}\nAbstract: {request.abstract}"
            gaps = await find_gaps_with_groq(summary, context)
            
            # 4. Store in cache
            await storage_manager.store_gaps(request.paper_id, gaps)
            logger.info(f"✅ Gaps cached for {request.paper_id}")
            
            tool_executed.labels(tool_name='find-gaps', status='success').inc()
            return {
                "paper_id": request.paper_id,
                "gaps": gaps,
                "cached": False
            }
            
    except Exception as e:
        logger.error(f"❌ Gap analysis failed: {e}")
        tool_executed.labels(tool_name='find-gaps', status='error').inc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ============================================================================
# Storage & Metrics Endpoints
# ============================================================================

@app.get("/storage/stats", dependencies=[Depends(verify_api_key)])
async def get_storage_stats():
    """Get storage statistics."""
    stats = {
        "redis": "unavailable",
        "chromadb": "unavailable"
    }
    
    # Redis stats
    try:
        redis_info = await redis_storage.ping()
        stats["redis"] = "connected" if redis_info else "disconnected"
    except:
        stats["redis"] = "error"
    
    # ChromaDB stats
    try:
        if not chroma_storage._initialized:
            chroma_storage.initialize()
        count = chroma_storage.papers_collection.count() if chroma_storage._initialized else 0
        stats["chromadb"] = {
            "status": "initialized" if chroma_storage._initialized else "not_initialized",
            "papers_count": count,
            "init_error": getattr(chroma_storage, "_init_error", None)
        }
    except Exception as e:
        stats["chromadb"] = {"status": "error", "message": str(e)}
    
    return stats

@app.get("/tools/metrics", dependencies=[Depends(verify_api_key)])
async def get_tool_metrics():
    """Get tool performance metrics."""
    return tool_registry.get_all_metrics()

# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
