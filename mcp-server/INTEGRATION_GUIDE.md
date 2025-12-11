# MCP Server Integration Guide

## Storage Layer Integration

This guide explains how to integrate the new Redis + ChromaDB storage layer with the existing MCP server.

## New Components Created

### 1. Storage Layer (`storage/`)
- **redis_storage.py**: Fast cache layer (< 1ms) with TTL management
- **vector_storage.py**: Permanent ChromaDB storage with semantic search
- **storage_manager.py**: Smart routing with three-tier fallback

### 2. Tool System (`tools/`)
- **registry.py**: Central tool registration with metrics
- **openalex_tool.py**: Fetch papers from OpenAlex API
- **embedding_tool.py**: SentenceTransformers (all-MiniLM-L6-v2, 384D)
- **clustering_tool.py**: K-means clustering on embeddings
- **gemini_tool.py**: Summarization with Gemini API
- **groq_tool.py**: Gap analysis + Groq fallback

##

 Integration Steps

### Step 1: Update main.py Imports

Add these imports to the top of `main.py`:

```python
from storage import storage_manager
from tools import (
    tool_registry,
    fetch_papers,
    generate_embeddings_batch,
    cluster_papers,
    summarize_with_gemini,
    find_gaps_with_groq,
    summarize_with_groq
)
from config import settings
```

### Step 2: Initialize Storage in Lifespan

Update the `lifespan` function in `main.py`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global redis_client, firestore_client, tool_registry, orchestrator
    
    # Startup
    logger.info("Starting MCP Server...")
    
    # Initialize NEW storage layer
    await storage_manager.initialize()
    logger.info("✅ Storage Manager initialized (Redis + ChromaDB)")
    
    # Keep existing initialization...
    redis_client = RedisClient(REDIS_URL, REDIS_PASSWORD)
    await redis_client.connect()
    
    # ... rest of existing code ...
    
    yield
    
    # Shutdown
    await storage_manager.close()
    logger.info("Storage Manager closed")
```

### Step 3: Add New Endpoints for On-Demand Operations

Add these endpoints to `main.py`:

```python
# ============================================================================
# NEW ENDPOINTS - On-Demand AI Operations with Caching
# ============================================================================

@app.post("/tools/summarize-paper")
async def summarize_paper_endpoint(
    paper_id: str,
    force_regenerate: bool = False,
    api_key: str = Depends(verify_api_key)
):
    """
    Summarize paper (on-demand, button click)
    Three-tier caching: Redis → ChromaDB → Gemini API (fallback Groq)
    """
    try:
        # Check cache first (unless force regenerate)
        if not force_regenerate:
            summary = await storage_manager.get_summary(paper_id)
            if summary:
                logger.info(f"✅ Summary {paper_id[:8]} from cache")
                return {
                    "paper_id": paper_id,
                    "summary": summary,
                    "cached": True
                }
        
        # Get paper details
        paper = await storage_manager.get_paper(paper_id)
        if not paper:
            raise HTTPException(404, f"Paper {paper_id} not found")
        
        # Generate summary with Gemini (fallback to Groq)
        try:
            summary = await summarize_with_gemini(paper)
        except Exception as e:
            logger.warning(f"Gemini failed, using Groq: {e}")
            summary = await summarize_with_groq(paper)
        
        # Store in both cache layers
        await storage_manager.store_summary(paper_id, summary)
        
        return {
            "paper_id": paper_id,
            "summary": summary,
            "cached": False,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(500, str(e))


@app.post("/tools/find-gaps")
async def find_gaps_endpoint(
    paper_id: str,
    context: str = "",
    force_regenerate: bool = False,
    api_key: str = Depends(verify_api_key)
):
    """
    Find research gaps (on-demand, button click)
    Requires summary first, then calls Groq
    """
    try:
        # Check cache first
        if not force_regenerate:
            gaps = await storage_manager.get_gaps(paper_id)
            if gaps:
                logger.info(f"✅ Gaps {paper_id[:8]} from cache")
                return {
                    "paper_id": paper_id,
                    "gaps": gaps,
                    "cached": True
                }
        
        # Ensure summary exists
        summary = await storage_manager.get_summary(paper_id)
        if not summary:
            # Generate summary first
            paper = await storage_manager.get_paper(paper_id)
            if not paper:
                raise HTTPException(404, f"Paper {paper_id} not found")
            
            try:
                summary = await summarize_with_gemini(paper)
            except:
                summary = await summarize_with_groq(paper)
            
            await storage_manager.store_summary(paper_id, summary)
        
        # Generate gaps with Groq
        gaps = await find_gaps_with_groq(summary, context)
        
        # Store in both cache layers
        await storage_manager.store_gaps(paper_id, gaps)
        
        return {
            "paper_id": paper_id,
            "gaps": gaps,
            "cached": False,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Gap analysis failed: {e}")
        raise HTTPException(500, str(e))


@app.post("/tools/batch-summarize")
async def batch_summarize_endpoint(
    paper_ids: List[str],
    api_key: str = Depends(verify_api_key)
):
    """
    Batch summarize papers (check cache first, only generate missing)
    """
    results = []
    
    for paper_id in paper_ids:
        try:
            # Check cache
            summary = await storage_manager.get_summary(paper_id)
            
            if summary:
                results.append({
                    "paper_id": paper_id,
                    "summary": summary,
                    "cached": True
                })
                continue
            
            # Generate
            paper = await storage_manager.get_paper(paper_id)
            if not paper:
                results.append({
                    "paper_id": paper_id,
                    "error": "Paper not found"
                })
                continue
            
            try:
                summary = await summarize_with_gemini(paper)
            except:
                summary = await summarize_with_groq(paper)
            
            await storage_manager.store_summary(paper_id, summary)
            
            results.append({
                "paper_id": paper_id,
                "summary": summary,
                "cached": False
            })
            
        except Exception as e:
            results.append({
                "paper_id": paper_id,
                "error": str(e)
            })
    
    return {
        "results": results,
        "total": len(paper_ids),
        "cached": sum(1 for r in results if r.get("cached")),
        "generated": sum(1 for r in results if not r.get("cached") and not r.get("error"))
    }


@app.post("/workflow/search")
async def search_workflow_endpoint(
    query: str,
    limit: int = 50,
    auto_cluster: bool = True,
    api_key: str = Depends(verify_api_key)
):
    """
    Immediate workflow (on search):
    1. Fetch papers from OpenAlex
    2. Generate embeddings
    3. Auto-cluster
    4. Store in ChromaDB
    
    Returns papers with cluster assignments (NO summarization yet)
    """
    try:
        # 1. Fetch papers
        papers = await fetch_papers(query, limit)
        logger.info(f"✅ Fetched {len(papers)} papers")
        
        # 2. Generate embeddings
        texts = [
            f"{p['title']} {p.get('abstract_text', '')}"
            for p in papers
        ]
        embeddings = await generate_embeddings_batch(texts)
        logger.info(f"✅ Generated {len(embeddings)} embeddings")
        
        # 3. Store papers with embeddings in ChromaDB
        for paper, embedding in zip(papers, embeddings):
            await storage_manager.store_paper(
                paper['paper_id'],
                paper,
                embedding
            )
        
        # 4. Auto-cluster if requested
        result = {
            "query": query,
            "total_papers": len(papers),
            "papers": papers
        }
        
        if auto_cluster and len(papers) > 1:
            cluster_result = await cluster_papers(papers, embeddings)
            result["clusters"] = cluster_result
            logger.info(f"✅ Clustered into {cluster_result['n_clusters']} groups")
        
        return result
        
    except Exception as e:
        logger.error(f"Search workflow failed: {e}")
        raise HTTPException(500, str(e))


@app.get("/storage/stats")
async def storage_stats_endpoint(api_key: str = Depends(verify_admin_api_key)):
    """Get storage layer statistics"""
    return await storage_manager.get_stats()


@app.get("/tools/metrics")
async def tool_metrics_endpoint(tool_name: Optional[str] = None):
    """Get tool execution metrics"""
    return tool_registry.get_metrics(tool_name)
```

### Step 4: Update Environment Variables

Add to `.env`:

```bash
# Gemini API
GEMINI_API_KEY=your-gemini-key

# Groq API
GROQ_API_KEY=your-groq-key

# ChromaDB
CHROMA_PERSIST_DIR=./data/chroma_db

# Rate Limits
GEMINI_RATE_LIMIT=5
GROQ_RATE_LIMIT=10
OPENALEX_RATE_LIMIT=10
```

### Step 5: Frontend Integration

Update frontend to call new endpoints:

```typescript
// Immediate (on search)
const results = await fetch('/workflow/search', {
  method: 'POST',
  body: JSON.stringify({ query, limit: 50, auto_cluster: true })
});

// On-demand (button click)
const summary = await fetch(`/tools/summarize-paper?paper_id=${paperId}`);
const gaps = await fetch(`/tools/find-gaps?paper_id=${paperId}`);
```

## Testing

1. **Start Redis**:
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run server**:
   ```bash
   python -m uvicorn main:app --reload --port 8001
   ```

4. **Test endpoints**:
   ```bash
   # Search and cluster
   curl -X POST "http://localhost:8001/workflow/search" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: development-key" \
     -d '{"query": "machine learning", "limit": 10}'
   
   # Summarize (will cache)
   curl -X POST "http://localhost:8001/tools/summarize-paper?paper_id=W12345" \
     -H "X-API-Key: development-key"
   ```

## Fallback Logic

### API Fallback
- **Gemini fails** → Automatically tries Groq
- **Both fail** → Returns error with message

### Storage Fallback
- **Redis unavailable** → Uses ChromaDB directly (slower but works)
- **Both unavailable** → Returns error

## Performance Expectations

- **Redis cache hit**: < 1ms
- **ChromaDB hit**: 10-50ms
- **Gemini API call**: 2-5s
- **Groq API call**: 1-3s
- **OpenAlex fetch**: 1-3s

## Next Steps

1. Test all endpoints with real API keys
2. Validate caching behavior (should see speedup on second request)
3. Monitor rate limits (check logs for ⏳ waiting messages)
4. Add frontend UI for summarization and gap analysis buttons
5. Run integration tests
