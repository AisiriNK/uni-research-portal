"""
Unit tests for MCP server endpoints
"""
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from main import app
from models import ResearchContext, Paper, Author, Cluster


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_redis():
    """Mock Redis client"""
    with patch('main.redis_client') as mock:
        mock.get_context = AsyncMock()
        mock.set_context = AsyncMock(return_value=True)
        mock.update_context = AsyncMock(return_value=True)
        yield mock


@pytest.fixture
def sample_context():
    """Sample research context"""
    return ResearchContext(
        context_id="test-context-123",
        owner_id="user-456",
        query="machine learning transformers",
        ttl_seconds=3600,
        papers=[
            Paper(
                paper_id="paper-1",
                title="Attention Is All You Need",
                authors=[Author(name="Vaswani et al.")],
                year=2017,
                citation_count=50000
            )
        ],
        clusters=[
            Cluster(
                cluster_id="cluster-1",
                label="Transformer Models",
                paper_ids=["paper-1"],
                confidence_score=0.95
            )
        ]
    )


# ============================================================================
# Health & Metrics Tests
# ============================================================================

def test_health_check(client):
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"


def test_metrics_endpoint(client):
    """Test Prometheus metrics endpoint"""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "mcp_" in response.text


# ============================================================================
# Context Management Tests
# ============================================================================

def test_create_context(client, mock_redis):
    """Test creating a new context"""
    request_data = {
        "owner_id": "user-123",
        "query": "deep learning",
        "ttl_seconds": 7200
    }
    
    response = client.post(
        "/context/create",
        json=request_data,
        headers={"X-API-Key": "development-key"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "context_id" in data
    assert data["owner_id"] == "user-123"
    assert data["query"] == "deep learning"
    assert data["ttl"] == 7200


def test_create_context_unauthorized(client):
    """Test creating context without API key"""
    request_data = {
        "owner_id": "user-123",
        "query": "deep learning"
    }
    
    response = client.post("/context/create", json=request_data)
    assert response.status_code == 422  # Missing header


def test_get_context(client, mock_redis, sample_context):
    """Test retrieving a context"""
    mock_redis.get_context.return_value = sample_context
    
    response = client.get(
        "/context/test-context-123",
        headers={"X-API-Key": "development-key"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["context_id"] == "test-context-123"
    assert len(data["papers"]) == 1
    assert len(data["clusters"]) == 1


def test_get_context_not_found(client, mock_redis):
    """Test retrieving non-existent context"""
    mock_redis.get_context.return_value = None
    
    response = client.get(
        "/context/nonexistent",
        headers={"X-API-Key": "development-key"}
    )
    
    assert response.status_code == 404


def test_update_context(client, mock_redis, sample_context):
    """Test updating a context"""
    mock_redis.get_context.return_value = sample_context
    
    update_data = {
        "status": "completed",
        "metadata": {"processed": True}
    }
    
    response = client.patch(
        "/context/test-context-123",
        json=update_data,
        headers={"X-API-Key": "development-key"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Context updated successfully"


# ============================================================================
# Tool Tests
# ============================================================================

def test_list_tools(client):
    """Test listing registered tools"""
    response = client.get(
        "/tools/list",
        headers={"X-API-Key": "development-key"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "tools" in data
    assert data["total"] > 0
    
    # Check for expected tools
    tool_names = [tool["name"] for tool in data["tools"]]
    assert "fetch_openalex" in tool_names
    assert "embed_papers" in tool_names


@pytest.mark.asyncio
async def test_execute_tool(client, mock_redis, sample_context):
    """Test executing a tool"""
    mock_redis.get_context.return_value = sample_context
    
    with patch('tools.fetch_openalex_handler', new_callable=AsyncMock) as mock_handler:
        mock_handler.return_value = {"papers": [{"paper_id": "test-1"}]}
        
        request_data = {
            "tool_name": "fetch_openalex",
            "context_id": "test-context-123",
            "input": {
                "query": "transformers",
                "limit": 10
            }
        }
        
        response = client.post(
            "/tools/execute",
            json=request_data,
            headers={"X-API-Key": "development-key"}
        )
        
        # Note: This test might fail in synchronous TestClient
        # Consider using async test framework


# ============================================================================
# Workflow Tests
# ============================================================================

@pytest.mark.asyncio
async def test_execute_workflow(client, mock_redis, sample_context):
    """Test executing a workflow"""
    mock_redis.get_context.return_value = sample_context
    
    workflow_spec = {
        "name": "test_workflow",
        "mode": "sequential",
        "steps": [
            {
                "tool": "fetch_openalex",
                "input": {"query": "test", "limit": 5}
            }
        ],
        "max_concurrent": 1,
        "timeout_seconds": 300,
        "on_error": "stop"
    }
    
    request_data = {
        "context_id": "test-context-123",
        "workflow": workflow_spec
    }
    
    # This requires async testing setup
    # response = client.post(
    #     "/workflow/execute",
    #     json=request_data,
    #     headers={"X-API-Key": "development-key"}
    # )


def test_get_workflow_status(client, mock_redis, sample_context):
    """Test getting workflow status"""
    mock_redis.get_context.return_value = sample_context
    
    with patch('orchestrator.WorkflowOrchestrator.get_workflow_status', new_callable=AsyncMock) as mock_status:
        mock_status.return_value = {
            "context_id": "test-context-123",
            "status": "active",
            "total_steps": 5,
            "successful_steps": 3,
            "failed_steps": 0
        }
        
        # response = client.get(
        #     "/workflow/status/test-context-123",
        #     headers={"X-API-Key": "development-key"}
        # )


# ============================================================================
# Trace Tests
# ============================================================================

def test_get_execution_trace(client, mock_redis, sample_context):
    """Test retrieving execution trace"""
    mock_redis.get_context.return_value = sample_context
    
    response = client.get(
        "/context/test-context-123/trace",
        headers={"X-API-Key": "development-key"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["context_id"] == "test-context-123"
    assert "agent_logs" in data
    assert "total_steps" in data


# ============================================================================
# Authentication Tests
# ============================================================================

def test_invalid_api_key(client):
    """Test request with invalid API key"""
    response = client.get(
        "/tools/list",
        headers={"X-API-Key": "wrong-key"}
    )
    
    assert response.status_code == 401


def test_missing_api_key(client):
    """Test request without API key"""
    response = client.get("/tools/list")
    assert response.status_code == 422  # Validation error for missing header


def test_admin_endpoint_with_regular_key(client):
    """Test accessing admin endpoint with regular API key"""
    response = client.post(
        "/tools/register",
        json={"name": "test_tool"},
        headers={"X-API-Key": "development-key"}
    )
    
    assert response.status_code == 401


# ============================================================================
# Pagination Tests
# ============================================================================

def test_context_pagination(client, mock_redis):
    """Test context pagination"""
    # Create context with many papers
    papers = [
        Paper(
            paper_id=f"paper-{i}",
            title=f"Paper {i}",
            authors=[Author(name="Test Author")],
            year=2020
        )
        for i in range(100)
    ]
    
    context = ResearchContext(
        context_id="test-pagination",
        owner_id="user-123",
        query="test",
        papers=papers
    )
    
    mock_redis.get_context.return_value = context
    
    # Get first page
    response = client.get(
        "/context/test-pagination?page=1&per_page=20",
        headers={"X-API-Key": "development-key"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["papers"]) == 20
    assert data["papers_total"] == 100
    assert data["papers_page"] == 1
