# MCP Research Hub Orchestration Server

A production-ready Model Context Protocol (MCP) server for orchestrating multi-agent AI workflows in academic research contexts.

## Overview

This MCP server acts as a shared context memory and orchestration hub for AI agents:
- **Groq Classifier**: Categorizes and clusters research papers
- **Gemini Summarizer**: Generates cluster summaries
- **Ollama Gap Detector**: Identifies research gaps
- **Analytics Agent**: Computes citation intelligence metrics

The server maintains shared context objects in Redis (with optional Firestore persistence) to avoid redundant processing and enable complex multi-agent workflows.

## Architecture

```
┌─────────────┐
│  Frontend   │
│  (React)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   FastAPI   │
│   Backend   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│     MCP Orchestration Server    │
│  ┌──────────────────────────┐  │
│  │  Context Manager         │  │
│  │  (Redis + Firestore)     │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  Tool Registry           │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  Workflow Orchestrator   │  │
│  │  (Sequential/Parallel)   │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  AI Agent Tools                 │
│  • OpenAlex API                 │
│  • Groq Classifier              │
│  • Gemini Summarizer            │
│  • Ollama Gap Analyzer          │
│  • Citation Intelligence        │
└─────────────────────────────────┘
```

## Features

- ✅ Shared context storage (Redis + optional Firestore)
- ✅ Tool registration and execution framework
- ✅ Sequential and parallel workflow orchestration
- ✅ Execution tracing and explainability
- ✅ Circuit breaker and retry mechanisms
- ✅ API key authentication
- ✅ Owner-based access control
- ✅ Prometheus metrics
- ✅ Docker containerization

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.10+ (for local development)

### Running with Docker Compose

```bash
# Clone and navigate to mcp-server directory
cd mcp-server

# Start all services (MCP server + Redis)
docker-compose up -d

# Check logs
docker-compose logs -f mcp-server

# Server will be available at http://localhost:8001
```

### Environment Variables

Create a `.env` file in the mcp-server directory:

```env
# Required
REDIS_URL=redis://redis:6379/0
MCP_API_KEY=your-secret-api-key-here
ADMIN_API_KEY=your-admin-key-here

# Optional (for Firestore persistence)
USE_FIRESTORE=false
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
FIRESTORE_PROJECT_ID=your-project-id

# External API Keys (replace stubs with real APIs)
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
OLLAMA_BASE_URL=http://localhost:11434

# Server Config
MCP_HOST=0.0.0.0
MCP_PORT=8001
CONTEXT_TTL_SECONDS=3600
LOG_LEVEL=INFO
```

## API Documentation

### Core Endpoints

#### Create Context
```bash
curl -X POST http://localhost:8001/context/create \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "owner_id": "user123",
    "query": "machine learning interpretability",
    "metadata": {
      "source": "research_hub",
      "count": 50
    }
  }'
```

Response:
```json
{
  "context_id": "550e8400-e29b-41d4-a716-446655440000",
  "owner_id": "user123",
  "query": "machine learning interpretability",
  "created_at": "2025-12-05T10:30:00Z",
  "ttl": 3600,
  "status": "created"
}
```

#### Get Context
```bash
curl -X GET http://localhost:8001/context/{context_id} \
  -H "X-API-Key: your-secret-api-key-here"
```

#### Update Context
```bash
curl -X PATCH http://localhost:8001/context/{context_id} \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "papers": [
      {
        "paper_id": "W123456",
        "title": "Interpretable ML",
        "abstract": "...",
        "authors": ["Smith J"],
        "year": 2024,
        "citation_count": 42
      }
    ]
  }'
```

#### Execute Tool
```bash
curl -X POST http://localhost:8001/tools/execute \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "fetch_openalex",
    "context_id": "550e8400-e29b-41d4-a716-446655440000",
    "input": {
      "query": "machine learning",
      "count": 20
    }
  }'
```

#### Execute Workflow
```bash
curl -X POST http://localhost:8001/workflow/execute \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "context_id": "550e8400-e29b-41d4-a716-446655440000",
    "workflow": {
      "name": "full_research_pipeline",
      "mode": "sequential",
      "steps": [
        {
          "tool": "fetch_openalex",
          "input": {"query": "machine learning", "count": 20}
        },
        {
          "tool": "embed_papers",
          "input": {"paper_ids": "*"}
        },
        {
          "tool": "classify_with_groq",
          "input": {}
        },
        {
          "tool": "summarize_with_gemini",
          "input": {"cluster_id": "*"}
        },
        {
          "tool": "gap_analysis_with_ollama",
          "input": {"cluster_id": "*"}
        },
        {
          "tool": "compute_citation_intel",
          "input": {}
        }
      ]
    }
  }'
```

#### Get Execution Trace
```bash
curl -X GET http://localhost:8001/context/{context_id}/trace \
  -H "X-API-Key: your-secret-api-key-here"
```

### Admin Endpoints

#### Register Tool
```bash
curl -X POST http://localhost:8001/tools/register \
  -H "X-API-Key: your-admin-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom_analyzer",
    "description": "Custom analysis tool",
    "input_schema": {
      "type": "object",
      "properties": {
        "data": {"type": "string"}
      }
    },
    "output_schema": {
      "type": "object",
      "properties": {
        "result": {"type": "string"}
      }
    },
    "handler": "custom_handler"
  }'
```

## Example Workflows

### Sequential Pipeline (Full Research Analysis)

```python
import requests

API_KEY = "your-secret-api-key-here"
BASE_URL = "http://localhost:8001"

# 1. Create context
response = requests.post(
    f"{BASE_URL}/context/create",
    headers={"X-API-Key": API_KEY},
    json={
        "owner_id": "researcher_001",
        "query": "explainable AI in healthcare",
        "metadata": {"domain": "healthcare"}
    }
)
context_id = response.json()["context_id"]

# 2. Execute sequential workflow
workflow_response = requests.post(
    f"{BASE_URL}/workflow/execute",
    headers={"X-API-Key": API_KEY},
    json={
        "context_id": context_id,
        "workflow": {
            "name": "research_pipeline",
            "mode": "sequential",
            "steps": [
                {"tool": "fetch_openalex", "input": {"query": "explainable AI healthcare", "count": 30}},
                {"tool": "embed_papers", "input": {"paper_ids": "*"}},
                {"tool": "classify_with_groq", "input": {}},
                {"tool": "summarize_with_gemini", "input": {"cluster_id": "*"}},
                {"tool": "gap_analysis_with_ollama", "input": {"cluster_id": "*"}},
                {"tool": "compute_citation_intel", "input": {}}
            ]
        }
    }
)

print("Workflow Status:", workflow_response.json()["status"])
print("Execution ID:", workflow_response.json()["execution_id"])

# 3. Get execution trace
trace_response = requests.get(
    f"{BASE_URL}/context/{context_id}/trace",
    headers={"X-API-Key": API_KEY}
)
print("Trace:", trace_response.json())
```

### Parallel Pipeline (Cluster Summarization)

```python
# Execute parallel workflow
parallel_response = requests.post(
    f"{BASE_URL}/workflow/execute",
    headers={"X-API-Key": API_KEY},
    json={
        "context_id": context_id,
        "workflow": {
            "name": "parallel_summarization",
            "mode": "parallel",
            "steps": [
                {"tool": "summarize_with_gemini", "input": {"cluster_id": "cluster_0"}},
                {"tool": "summarize_with_gemini", "input": {"cluster_id": "cluster_1"}},
                {"tool": "summarize_with_gemini", "input": {"cluster_id": "cluster_2"}},
            ],
            "max_concurrent": 3
        }
    }
)
```

## Development

### Local Setup (without Docker)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Start Redis locally
docker run -d -p 6379:6379 redis:alpine

# Run server
python main.py
```

### Running Tests

```bash
# Install test dependencies
pip install -r requirements-test.txt

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html

# Run specific test
pytest tests/test_context.py::test_create_context -v
```

### Code Quality

```bash
# Format code
black .

# Lint
flake8 .
mypy .

# Security scan
bandit -r .
```

## Monitoring

### Prometheus Metrics

Metrics are exposed at `http://localhost:8001/metrics`:

- `mcp_requests_total`: Total HTTP requests
- `mcp_request_duration_seconds`: Request latency histogram
- `mcp_context_operations_total`: Context CRUD operations
- `mcp_tool_executions_total`: Tool execution count
- `mcp_tool_execution_duration_seconds`: Tool execution time
- `mcp_workflow_executions_total`: Workflow execution count
- `mcp_active_contexts`: Current active contexts

### Health Check

```bash
curl http://localhost:8001/health
```

Response:
```json
{
  "status": "healthy",
  "redis": "connected",
  "firestore": "disabled",
  "uptime_seconds": 3600
}
```

## Configuration

### MCP Config (mcp_config.yaml)

The server loads tool definitions and workflow templates from `mcp_config.yaml`:

```yaml
tools:
  - name: fetch_openalex
    description: Fetch academic papers from OpenAlex API
    handler: tools.fetch_openalex_handler
    timeout: 30
    retries: 3
    
  - name: classify_with_groq
    description: Classify papers using Groq LLM
    handler: tools.groq_classifier_handler
    timeout: 60
    retries: 2

workflows:
  - name: standard_pipeline
    mode: sequential
    steps:
      - fetch_openalex
      - embed_papers
      - classify_with_groq
      - summarize_with_gemini
      - gap_analysis_with_ollama
      - compute_citation_intel
```

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connectivity
docker exec -it mcp-redis redis-cli ping
# Should return: PONG

# Check Redis logs
docker-compose logs redis
```

### Context Not Found

Contexts have a TTL (default 1 hour). Check if context expired:

```bash
curl http://localhost:8001/context/{context_id}
# Returns 404 if expired
```

### Tool Execution Failures

Check execution trace for detailed error:

```bash
curl http://localhost:8001/context/{context_id}/trace | jq '.agent_logs[] | select(.status=="error")'
```

## Security Considerations

1. **API Keys**: Always use strong, randomly generated keys
2. **Rate Limiting**: Configure rate limits in production
3. **Input Validation**: All inputs are validated via Pydantic
4. **Owner Isolation**: Contexts are isolated by owner_id
5. **HTTPS**: Use HTTPS in production (configure reverse proxy)

## Performance Tuning

- **Redis Connection Pool**: Adjust `REDIS_POOL_SIZE` env var
- **Context TTL**: Increase `CONTEXT_TTL_SECONDS` for long-running workflows
- **Parallel Workers**: Set `MAX_PARALLEL_WORKERS` for concurrent tool execution
- **Timeouts**: Configure per-tool timeouts in `mcp_config.yaml`

## Production Deployment

### Using Docker Swarm

```bash
docker stack deploy -c docker-compose.prod.yml mcp-stack
```

### Using Kubernetes

```bash
kubectl apply -f k8s/
```

(Kubernetes manifests available in `k8s/` directory)

## License

MIT License - see LICENSE file

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/mcp-server/issues
- Documentation: https://docs.your-org.com/mcp-server
- Email: support@your-org.com
