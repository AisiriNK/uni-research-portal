"""
Example client for interacting with MCP server
"""
import asyncio
import httpx
from typing import Dict, Any, List, Optional


class MCPClient:
    """
    Python client for MCP server API.
    
    Example usage:
        client = MCPClient(
            base_url="http://localhost:8001",
            api_key="your-api-key"
        )
        
        # Create context
        context = await client.create_context(
            owner_id="user-123",
            query="machine learning transformers"
        )
        
        # Execute workflow
        result = await client.execute_workflow(
            context_id=context["context_id"],
            workflow=workflow_spec
        )
    """
    
    def __init__(
        self,
        base_url: str = "http://localhost:8001",
        api_key: str = "development-key",
        timeout: float = 60.0
    ):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check server health"""
        response = await self.client.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()
    
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
        """Retrieve a context with pagination"""
        response = await self.client.get(
            f"{self.base_url}/context/{context_id}",
            headers=self.headers,
            params={"page": page, "per_page": per_page}
        )
        response.raise_for_status()
        return response.json()
    
    async def update_context(
        self,
        context_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update a context"""
        response = await self.client.patch(
            f"{self.base_url}/context/{context_id}",
            headers=self.headers,
            json=updates
        )
        response.raise_for_status()
        return response.json()
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools"""
        response = await self.client.get(
            f"{self.base_url}/tools/list",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()["tools"]
    
    async def execute_tool(
        self,
        tool_name: str,
        context_id: str,
        input_data: Dict[str, Any],
        timeout_override: Optional[int] = None
    ) -> Dict[str, Any]:
        """Execute a single tool"""
        payload = {
            "tool_name": tool_name,
            "context_id": context_id,
            "input": input_data
        }
        if timeout_override:
            payload["timeout_override"] = timeout_override
        
        response = await self.client.post(
            f"{self.base_url}/tools/execute",
            headers=self.headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    async def execute_workflow(
        self,
        context_id: str,
        workflow: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a complete workflow"""
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
    
    async def get_workflow_status(self, context_id: str) -> Dict[str, Any]:
        """Get workflow execution status"""
        response = await self.client.get(
            f"{self.base_url}/workflow/status/{context_id}",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    async def get_execution_trace(self, context_id: str) -> Dict[str, Any]:
        """Get complete execution trace for a context"""
        response = await self.client.get(
            f"{self.base_url}/context/{context_id}/trace",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()


# ============================================================================
# Example Usage
# ============================================================================

async def example_sequential_workflow():
    """Example: Execute a sequential research pipeline"""
    client = MCPClient(api_key="your-api-key-here")
    
    try:
        # 1. Create context
        print("Creating research context...")
        context = await client.create_context(
            owner_id="researcher-001",
            query="transformer models in natural language processing",
            ttl_seconds=7200
        )
        context_id = context["context_id"]
        print(f"✓ Context created: {context_id}")
        
        # 2. Define workflow
        workflow = {
            "name": "research_analysis_pipeline",
            "mode": "sequential",
            "steps": [
                {
                    "tool": "fetch_openalex",
                    "input": {
                        "query": "transformers NLP",
                        "limit": 25
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
                        "num_clusters": 5
                    }
                },
                {
                    "tool": "classify_with_groq",
                    "input": {
                        "paper_ids": [],
                        "categories": ["NLP", "CV", "Speech", "Multimodal"]
                    }
                }
            ],
            "max_concurrent": 1,
            "timeout_seconds": 600,
            "on_error": "stop"
        }
        
        # 3. Execute workflow
        print("\nExecuting workflow...")
        result = await client.execute_workflow(context_id, workflow)
        print(f"✓ Workflow completed: {result['status']}")
        print(f"  Steps: {result['steps_completed']}/{result['steps_total']}")
        print(f"  Execution time: {result['execution_time_ms']:.2f}ms")
        
        # 4. Get updated context
        print("\nFetching results...")
        updated_context = await client.get_context(context_id)
        print(f"  Papers: {updated_context['papers_total']}")
        print(f"  Clusters: {len(updated_context['clusters'])}")
        print(f"  Embeddings: {updated_context['embeddings_count']}")
        
        # 5. View execution trace
        trace = await client.get_execution_trace(context_id)
        print(f"\nExecution trace ({trace['total_steps']} steps):")
        for log in trace['agent_logs'][-5:]:  # Last 5 steps
            print(f"  - {log['agent']}: {log['status']} ({log['execution_time_ms']:.2f}ms)")
    
    finally:
        await client.close()


async def example_parallel_cluster_analysis():
    """Example: Parallel cluster summarization"""
    client = MCPClient(api_key="your-api-key-here")
    
    try:
        # Create context
        context = await client.create_context(
            owner_id="researcher-002",
            query="machine learning research gaps",
            ttl_seconds=7200
        )
        context_id = context["context_id"]
        
        # Parallel workflow for cluster analysis
        workflow = {
            "name": "parallel_cluster_analysis",
            "mode": "parallel",
            "steps": [
                {
                    "tool": "summarize_with_gemini",
                    "input": {
                        "cluster_id": f"cluster-{i}",
                        "paper_ids": [f"paper-{i}-{j}" for j in range(5)],
                        "abstracts": ["Abstract text..." for _ in range(5)]
                    }
                }
                for i in range(5)  # 5 clusters
            ],
            "max_concurrent": 5,
            "timeout_seconds": 300,
            "on_error": "continue"
        }
        
        result = await client.execute_workflow(context_id, workflow)
        print(f"Parallel workflow: {result['status']}")
        print(f"Clusters analyzed: {result['steps_completed']}")
    
    finally:
        await client.close()


if __name__ == "__main__":
    print("=== MCP Client Example ===\n")
    print("Running sequential workflow example...")
    asyncio.run(example_sequential_workflow())
