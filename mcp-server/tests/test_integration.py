"""
Integration tests for complete workflow execution
"""
import pytest
import asyncio
from datetime import datetime

from models import (
    ResearchContext, WorkflowSpec, WorkflowStep,
    CreateContextRequest
)
from utils import RedisClient, generate_context_id
from tools import initialize_tool_registry
from orchestrator import WorkflowOrchestrator


# Skip integration tests if Redis is not available
pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
async def redis_client():
    """Create real Redis client for integration tests"""
    client = RedisClient("redis://localhost:6379/1", None)  # Use DB 1 for tests
    await client.connect()
    yield client
    await client.disconnect()


@pytest.fixture
def tool_registry():
    """Create real tool registry"""
    return initialize_tool_registry()


@pytest.fixture
def orchestrator_instance(tool_registry, redis_client):
    """Create real orchestrator"""
    return WorkflowOrchestrator(tool_registry, redis_client)


@pytest.mark.asyncio
async def test_end_to_end_sequential_workflow(redis_client, tool_registry, orchestrator_instance):
    """
    End-to-end test: Create context -> Execute sequential workflow -> Verify results
    """
    # 1. Create context
    context_id = generate_context_id()
    context = ResearchContext(
        context_id=context_id,
        owner_id="integration-test-user",
        query="machine learning transformers",
        ttl_seconds=3600
    )
    
    success = await redis_client.set_context(context_id, context)
    assert success, "Failed to create context"
    
    # 2. Define workflow
    workflow = WorkflowSpec(
        name="integration_test_sequential",
        mode="sequential",
        steps=[
            # Fetch papers
            WorkflowStep(
                tool="fetch_openalex",
                input={
                    "query": "transformers",
                    "limit": 10
                }
            ),
            # Generate embeddings (mock)
            WorkflowStep(
                tool="embed_papers",
                input={
                    "paper_ids": [],  # Will use context papers
                    "model": "text-embedding-ada-002"
                }
            ),
            # Classify papers
            WorkflowStep(
                tool="classify_with_groq",
                input={
                    "paper_ids": [],
                    "categories": ["NLP", "CV", "ML"]
                }
            )
        ],
        max_concurrent=1,
        timeout_seconds=300,
        on_error="stop"
    )
    
    # 3. Execute workflow
    result = await orchestrator_instance.execute_workflow(context_id, workflow)
    
    # 4. Verify results
    assert result.status in ["completed", "partial"], f"Workflow failed: {result.status}"
    assert result.steps_completed > 0, "No steps completed"
    assert len(result.results) > 0, "No results returned"
    
    # 5. Verify context was updated
    updated_context = await redis_client.get_context(context_id)
    assert updated_context is not None, "Context not found after workflow"
    assert len(updated_context.agent_logs) > 0, "No agent logs recorded"
    
    # 6. Cleanup
    await redis_client.delete_context(context_id)


@pytest.mark.asyncio
async def test_end_to_end_parallel_workflow(redis_client, tool_registry, orchestrator_instance):
    """
    End-to-end test: Parallel cluster summarization
    """
    # 1. Create context with clusters
    context_id = generate_context_id()
    
    from models import Cluster
    context = ResearchContext(
        context_id=context_id,
        owner_id="integration-test-user",
        query="AI research",
        ttl_seconds=3600,
        clusters=[
            Cluster(
                cluster_id=f"cluster-{i}",
                label=f"Research Theme {i}",
                paper_ids=[f"paper-{i}-1", f"paper-{i}-2"],
                confidence_score=0.8
            )
            for i in range(3)
        ]
    )
    
    success = await redis_client.set_context(context_id, context)
    assert success, "Failed to create context"
    
    # 2. Define parallel workflow for cluster summarization
    workflow = WorkflowSpec(
        name="integration_test_parallel",
        mode="parallel",
        steps=[
            WorkflowStep(
                tool="summarize_with_gemini",
                input={
                    "cluster_id": f"cluster-{i}",
                    "paper_ids": [f"paper-{i}-1", f"paper-{i}-2"],
                    "abstracts": ["Abstract 1", "Abstract 2"]
                }
            )
            for i in range(3)
        ],
        max_concurrent=3,
        timeout_seconds=300,
        on_error="continue"
    )
    
    # 3. Execute workflow
    result = await orchestrator_instance.execute_workflow(context_id, workflow)
    
    # 4. Verify all steps executed
    assert result.steps_completed == 3, f"Expected 3 steps, got {result.steps_completed}"
    assert result.status == "completed", f"Workflow status: {result.status}"
    
    # 5. Cleanup
    await redis_client.delete_context(context_id)


@pytest.mark.asyncio
async def test_workflow_with_error_handling(redis_client, tool_registry, orchestrator_instance):
    """
    Test workflow error handling and recovery
    """
    context_id = generate_context_id()
    context = ResearchContext(
        context_id=context_id,
        owner_id="integration-test-user",
        query="error handling test",
        ttl_seconds=3600
    )
    
    await redis_client.set_context(context_id, context)
    
    # Workflow with intentionally invalid inputs to test error handling
    workflow = WorkflowSpec(
        name="error_handling_test",
        mode="sequential",
        steps=[
            WorkflowStep(
                tool="fetch_openalex",
                input={"query": "test", "limit": 5}
            ),
            # This might fail due to empty paper_ids
            WorkflowStep(
                tool="embed_papers",
                input={"paper_ids": [], "model": "invalid-model"}
            )
        ],
        max_concurrent=1,
        timeout_seconds=300,
        on_error="continue"  # Continue despite errors
    )
    
    result = await orchestrator_instance.execute_workflow(context_id, workflow)
    
    # Should complete at least the first step
    assert result.steps_completed >= 1, "Expected at least one step to complete"
    
    # Check execution trace
    updated_context = await redis_client.get_context(context_id)
    assert len(updated_context.agent_logs) > 0, "No logs recorded"
    
    # Cleanup
    await redis_client.delete_context(context_id)


@pytest.mark.asyncio
async def test_context_ttl_and_persistence(redis_client):
    """
    Test context TTL expiration
    """
    # Create context with short TTL
    context_id = generate_context_id()
    context = ResearchContext(
        context_id=context_id,
        owner_id="ttl-test-user",
        query="TTL test",
        ttl_seconds=2  # 2 seconds TTL
    )
    
    await redis_client.set_context(context_id, context)
    
    # Verify it exists
    retrieved = await redis_client.get_context(context_id)
    assert retrieved is not None, "Context should exist immediately"
    
    # Wait for TTL to expire
    await asyncio.sleep(3)
    
    # Context should be gone
    retrieved = await redis_client.get_context(context_id)
    assert retrieved is None, "Context should have expired"


@pytest.mark.asyncio
async def test_concurrent_workflow_executions(redis_client, tool_registry, orchestrator_instance):
    """
    Test multiple concurrent workflow executions
    """
    # Create multiple contexts
    context_ids = [generate_context_id() for _ in range(3)]
    
    for context_id in context_ids:
        context = ResearchContext(
            context_id=context_id,
            owner_id="concurrent-test",
            query=f"test query {context_id}",
            ttl_seconds=3600
        )
        await redis_client.set_context(context_id, context)
    
    # Define simple workflow
    workflow = WorkflowSpec(
        name="concurrent_test",
        mode="sequential",
        steps=[
            WorkflowStep(
                tool="fetch_openalex",
                input={"query": "test", "limit": 5}
            )
        ],
        timeout_seconds=300,
        on_error="stop"
    )
    
    # Execute workflows concurrently
    tasks = [
        orchestrator_instance.execute_workflow(context_id, workflow)
        for context_id in context_ids
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Verify all completed
    assert len(results) == 3, "Expected 3 results"
    for result in results:
        if isinstance(result, Exception):
            pytest.fail(f"Workflow failed with exception: {result}")
        assert result.status in ["completed", "partial"], f"Workflow status: {result.status}"
    
    # Cleanup
    for context_id in context_ids:
        await redis_client.delete_context(context_id)
