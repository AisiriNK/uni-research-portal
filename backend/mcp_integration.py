"""
MCP Integration for Backend
Connects Research Hub backend with MCP server and provides real tool implementations
"""
import os
import httpx
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)

# MCP Server configuration
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8001")
MCP_API_KEY = os.getenv("MCP_API_KEY", "development-key")

class MCPClient:
    """Client for interacting with MCP server"""
    
    def __init__(self, base_url: str = MCP_SERVER_URL, api_key: str = MCP_API_KEY):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        self.client = httpx.AsyncClient(timeout=60.0)
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
    
    async def create_context(
        self,
        owner_id: str,
        query: str,
        ttl_seconds: int = 3600,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a new research context"""
        response = await self.client.post(
            f"{self.base_url}/context/create",
            headers=self.headers,
            json={
                "owner_id": owner_id,
                "query": query,
                "ttl_seconds": ttl_seconds,
                "metadata": metadata or {}
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def get_context(
        self,
        context_id: str,
        page: int = 1,
        per_page: int = 50
    ) -> Dict[str, Any]:
        """Retrieve context with results"""
        response = await self.client.get(
            f"{self.base_url}/context/{context_id}",
            headers=self.headers,
            params={"page": page, "per_page": per_page}
        )
        response.raise_for_status()
        return response.json()
    
    async def execute_workflow(
        self,
        context_id: str,
        workflow: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a workflow"""
        response = await self.client.post(
            f"{self.base_url}/workflow/execute",
            headers=self.headers,
            json={
                "context_id": context_id,
                "workflow": workflow
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check MCP server health"""
        response = await self.client.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()


# Global MCP client instance
mcp_client = MCPClient()


async def orchestrate_paper_clustering(
    query: str,
    limit: int = 50,
    num_clusters: int = 5,
    owner_id: str = "backend_user"
) -> Dict[str, Any]:
    """
    Orchestrate paper clustering using MCP server
    Replaces direct clustering logic with MCP workflow
    """
    logger.info(f"Orchestrating paper clustering via MCP: query='{query}', limit={limit}")
    
    # Create context
    context = await mcp_client.create_context(
        owner_id=owner_id,
        query=query,
        ttl_seconds=3600,
        metadata={
            "source": "backend_api",
            "endpoint": "cluster_tree"
        }
    )
    
    context_id = context["context_id"]
    logger.info(f"Created MCP context: {context_id}")
    
    # Define workflow
    workflow = {
        "name": "paper_clustering_workflow",
        "mode": "sequential",
        "steps": [
            {
                "tool": "fetch_openalex",
                "input": {
                    "query": query,
                    "limit": limit
                }
            },
            {
                "tool": "embed_papers",
                "input": {
                    "paper_ids": [],
                    "model": "text-embedding-ada-002"
                }
            },
            {
                "tool": "cluster_papers",
                "input": {
                    "embedding_ids": [],
                    "num_clusters": num_clusters,
                    "algorithm": "kmeans"
                }
            },
            {
                "tool": "classify_with_groq",
                "input": {
                    "paper_ids": [],
                    "categories": ["Machine Learning", "Deep Learning", "NLP", "Computer Vision", "Robotics", "Theory"]
                }
            }
        ],
        "max_concurrent": 1,
        "timeout_seconds": 300,
        "on_error": "continue"
    }
    
    # Execute workflow
    result = await mcp_client.execute_workflow(context_id, workflow)
    logger.info(f"Workflow completed: status={result['status']}, steps={result['steps_completed']}/{result['steps_total']}")
    
    # Get final context with results
    context_data = await mcp_client.get_context(context_id)
    
    return {
        "context_id": context_id,
        "workflow_result": result,
        "papers": context_data.get("papers", []),
        "clusters": context_data.get("clusters", []),
        "execution_time_ms": result.get("execution_time_ms", 0)
    }


async def orchestrate_research_gaps(
    base_paper: Dict[str, Any],
    related_papers: List[Dict[str, Any]],
    domain: str = "Computer Science",
    owner_id: str = "backend_user"
) -> Dict[str, Any]:
    """
    Orchestrate research gap analysis using MCP server
    """
    logger.info(f"Orchestrating gap analysis via MCP for: {base_paper.get('title', 'Unknown')}")
    
    # Create context
    context = await mcp_client.create_context(
        owner_id=owner_id,
        query=f"Research gaps for: {base_paper.get('title', '')}",
        ttl_seconds=7200,
        metadata={
            "base_paper_id": base_paper.get("id"),
            "domain": domain,
            "related_papers_count": len(related_papers)
        }
    )
    
    context_id = context["context_id"]
    
    # Define workflow
    workflow = {
        "name": "research_gap_analysis",
        "mode": "sequential",
        "steps": [
            {
                "tool": "classify_with_groq",
                "input": {
                    "paper_ids": [p.get("id") for p in related_papers[:20]],
                    "categories": ["Established Research", "Emerging Topics", "Novel Approaches"]
                }
            },
            {
                "tool": "gap_analysis_with_ollama",
                "input": {
                    "cluster_id": "main_cluster",
                    "papers": related_papers,
                    "domain": domain
                }
            },
            {
                "tool": "summarize_with_gemini",
                "input": {
                    "cluster_id": "gap_summary",
                    "paper_ids": [p.get("id") for p in related_papers[:10]],
                    "abstracts": [p.get("abstract", "") for p in related_papers[:10]]
                }
            }
        ],
        "timeout_seconds": 400,
        "on_error": "continue"
    }
    
    # Execute workflow
    result = await mcp_client.execute_workflow(context_id, workflow)
    logger.info(f"Gap analysis workflow completed: {result['status']}")
    
    # Get results
    context_data = await mcp_client.get_context(context_id)
    
    # Extract gap analysis results
    gap_tool_result = next(
        (r for r in result.get("results", []) if r.get("tool_name") == "gap_analysis_with_ollama"),
        None
    )
    
    research_gaps = []
    if gap_tool_result and gap_tool_result.get("output"):
        research_gaps = gap_tool_result["output"].get("research_gaps", [])
    
    return {
        "context_id": context_id,
        "research_gaps": research_gaps,
        "workflow_result": result,
        "agent_logs": context_data.get("agent_logs", [])
    }


async def get_cached_context(context_id: str) -> Optional[Dict[str, Any]]:
    """
    Get cached results from previous MCP workflow execution
    """
    try:
        return await mcp_client.get_context(context_id)
    except Exception as e:
        logger.error(f"Failed to get cached context {context_id}: {e}")
        return None


async def check_mcp_health() -> bool:
    """Check if MCP server is healthy"""
    try:
        health = await mcp_client.health_check()
        return health.get("status") == "healthy"
    except Exception as e:
        logger.warning(f"MCP health check failed: {e}")
        return False
