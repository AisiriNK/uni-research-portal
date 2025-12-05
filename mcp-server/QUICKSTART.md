# MCP Server - Quick Start Guide

This guide will get you up and running with the MCP (Model Context Protocol) server in 5 minutes.

## Prerequisites

- Python 3.10+
- Docker & Docker Compose (optional, but recommended)
- Redis (if running without Docker)

## Option 1: Docker Compose (Recommended)

### 1. Clone and Setup

```bash
cd mcp-server
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` and set your API keys:

```bash
# Required
API_KEY=your-secret-api-key-here
ADMIN_API_KEY=your-admin-secret-key-here

# Optional: External AI service keys
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
```

### 3. Start Services

```bash
docker-compose up -d
```

This starts:
- **Redis** on port 6379
- **MCP Server** on port 8001

### 4. Verify Health

```bash
curl http://localhost:8001/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000000",
  "redis": "connected",
  "firestore": "disabled"
}
```

## Option 2: Local Python Setup

### 1. Install Dependencies

```bash
cd mcp-server
pip install -r requirements.txt
```

### 2. Start Redis

```bash
# macOS/Linux
redis-server

# Windows (with WSL or Redis for Windows)
redis-server.exe
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Run Server

```bash
python main.py
```

Server starts on `http://localhost:8001`

## Quick Usage Examples

### 1. Create a Research Context

```bash
curl -X POST http://localhost:8001/context/create \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "owner_id": "researcher-123",
    "query": "transformer models in NLP",
    "ttl_seconds": 3600
  }'
```

Response:
```json
{
  "context_id": "abc123-def456-...",
  "owner_id": "researcher-123",
  "query": "transformer models in NLP",
  "created_at": "2024-01-15T10:30:00",
  "ttl": 3600,
  "status": "active"
}
```

**Save the `context_id`** for next steps!

### 2. Execute a Tool

```bash
curl -X POST http://localhost:8001/tools/execute \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "fetch_openalex",
    "context_id": "abc123-def456-...",
    "input": {
      "query": "attention mechanisms",
      "limit": 10
    }
  }'
```

### 3. Execute a Workflow

```bash
curl -X POST http://localhost:8001/workflow/execute \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "context_id": "abc123-def456-...",
    "workflow": {
      "name": "quick_research_pipeline",
      "mode": "sequential",
      "steps": [
        {
          "tool": "fetch_openalex",
          "input": {
            "query": "transformers",
            "limit": 20
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
            "num_clusters": 3
          }
        }
      ],
      "max_concurrent": 1,
      "timeout_seconds": 300,
      "on_error": "stop"
    }
  }'
```

### 4. Get Context with Results

```bash
curl http://localhost:8001/context/abc123-def456-... \
  -H "X-API-Key: your-secret-api-key-here"
```

### 5. View Execution Trace

```bash
curl http://localhost:8001/context/abc123-def456-.../trace \
  -H "X-API-Key: your-secret-api-key-here"
```

## Python Client Example

```python
import httpx
import asyncio

class MCPClient:
    def __init__(self, base_url="http://localhost:8001", api_key="your-key"):
        self.base_url = base_url
        self.headers = {"X-API-Key": api_key}
        self.client = httpx.AsyncClient()
    
    async def create_context(self, owner_id: str, query: str):
        response = await self.client.post(
            f"{self.base_url}/context/create",
            headers=self.headers,
            json={
                "owner_id": owner_id,
                "query": query,
                "ttl_seconds": 3600
            }
        )
        return response.json()
    
    async def execute_workflow(self, context_id: str, workflow: dict):
        response = await self.client.post(
            f"{self.base_url}/workflow/execute",
            headers=self.headers,
            json={
                "context_id": context_id,
                "workflow": workflow
            }
        )
        return response.json()

async def main():
    client = MCPClient(api_key="your-secret-api-key-here")
    
    # Create context
    context = await client.create_context(
        owner_id="user-123",
        query="deep learning optimization"
    )
    context_id = context["context_id"]
    print(f"Created context: {context_id}")
    
    # Execute workflow
    workflow = {
        "name": "research_pipeline",
        "mode": "sequential",
        "steps": [
            {
                "tool": "fetch_openalex",
                "input": {"query": "deep learning", "limit": 10}
            }
        ],
        "timeout_seconds": 300,
        "on_error": "stop"
    }
    
    result = await client.execute_workflow(context_id, workflow)
    print(f"Workflow status: {result['status']}")
    print(f"Steps completed: {result['steps_completed']}/{result['steps_total']}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Available Tools

The MCP server comes pre-configured with these tools:

1. **fetch_openalex** - Fetch papers from OpenAlex API
2. **embed_papers** - Generate embeddings for papers
3. **classify_with_groq** - Classify papers using Groq
4. **summarize_with_gemini** - Summarize clusters with Gemini
5. **gap_analysis_with_ollama** - Find research gaps with Ollama
6. **compute_citation_intel** - Calculate citation metrics
7. **cluster_papers** - Cluster papers by similarity

List all tools:
```bash
curl http://localhost:8001/tools/list -H "X-API-Key: your-key"
```

## Monitoring

### Prometheus Metrics

```bash
curl http://localhost:8001/metrics
```

Metrics include:
- `mcp_context_created_total` - Contexts created
- `mcp_tool_executed_total` - Tool executions
- `mcp_workflow_executed_total` - Workflow executions
- `mcp_request_duration_seconds` - Request latencies

### Logs

Docker:
```bash
docker-compose logs -f mcp-server
```

Local:
Logs print to stdout with configurable `LOG_LEVEL` in `.env`

## Testing

### Run Unit Tests

```bash
pip install -r tests/requirements-test.txt
pytest tests/test_main.py -v
```

### Run Integration Tests (requires Redis)

```bash
pytest tests/test_integration.py -v -m integration
```

### Run All Tests with Coverage

```bash
pytest tests/ --cov=. --cov-report=html
```

## Troubleshooting

### Redis Connection Failed

**Error:** `Redis client not connected`

**Solution:**
```bash
# Check if Redis is running
docker-compose ps redis
# or
redis-cli ping
```

### API Key Invalid

**Error:** `401 Unauthorized`

**Solution:** Verify API key in `.env` matches the one in your request header.

### Tool Timeout

**Error:** `Tool execution timed out`

**Solution:** Increase timeout in tool execution request:
```json
{
  "tool_name": "fetch_openalex",
  "context_id": "...",
  "input": {...},
  "timeout_override": 120
}
```

### Context Not Found

**Error:** `404 Context not found`

**Reasons:**
- Context expired (check TTL)
- Wrong context_id
- Redis connection lost

## Next Steps

- Read the full [README.md](README.md) for architecture details
- Explore workflow examples in [mcp_config.yaml](mcp_config.yaml)
- Customize tools in [tools.py](tools.py)
- Deploy to production (see README.md deployment section)

## Support

For issues or questions:
1. Check logs: `docker-compose logs mcp-server`
2. Verify health: `curl http://localhost:8001/health`
3. Review [README.md](README.md) for detailed documentation

Happy orchestrating! 🚀
