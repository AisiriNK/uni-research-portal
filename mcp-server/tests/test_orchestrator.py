"""
Tests for workflow orchestration
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from orchestrator import WorkflowOrchestrator
from models import WorkflowSpec, WorkflowStep, ResearchContext
from tools import ToolRegistry
from utils import RedisClient


@pytest.fixture
def mock_redis_client():
    """Mock Redis client"""
    client = MagicMock(spec=RedisClient)
    client.get_context = AsyncMock()
    client.set_context = AsyncMock(return_value=True)
    return client


@pytest.fixture
def mock_tool_registry():
    """Mock tool registry"""
    registry = MagicMock(spec=ToolRegistry)
    registry.execute = AsyncMock()
    return registry


@pytest.fixture
def sample_context():
    """Sample research context"""
    return ResearchContext(
        context_id="test-workflow-context",
        owner_id="user-123",
        query="test query"
    )


@pytest.fixture
def orchestrator(mock_tool_registry, mock_redis_client):
    """Create workflow orchestrator"""
    return WorkflowOrchestrator(mock_tool_registry, mock_redis_client)


# ============================================================================
# Sequential Workflow Tests
# ============================================================================

@pytest.mark.asyncio
async def test_sequential_workflow_success(orchestrator, mock_redis_client, mock_tool_registry, sample_context):
    """Test successful sequential workflow execution"""
    mock_redis_client.get_context.return_value = sample_context
    
    # Mock successful tool execution
    from models import ToolExecutionResponse
    mock_tool_registry.execute.return_value = ToolExecutionResponse(
        execution_id="exec-1",
        tool_name="test_tool",
        context_id="test-workflow-context",
        status="success",
        output={"result": "success"},
        execution_time_ms=100.0
    )
    
    workflow = WorkflowSpec(
        name="test_sequential",
        mode="sequential",
        steps=[
            WorkflowStep(tool="tool1", input={"param": "value1"}),
            WorkflowStep(tool="tool2", input={"param": "value2"})
        ],
        timeout_seconds=300,
        on_error="stop"
    )
    
    result = await orchestrator.execute_workflow("test-workflow-context", workflow)
    
    assert result.status == "completed"
    assert result.steps_completed == 2
    assert result.steps_failed == 0
    assert len(result.results) == 2


@pytest.mark.asyncio
async def test_sequential_workflow_with_error_stop(orchestrator, mock_redis_client, mock_tool_registry, sample_context):
    """Test sequential workflow that stops on error"""
    mock_redis_client.get_context.return_value = sample_context
    
    from models import ToolExecutionResponse
    
    # First tool succeeds, second fails
    async def mock_execute(tool_name, context_id, input_data, timeout_override):
        if tool_name == "tool1":
            return ToolExecutionResponse(
                execution_id="exec-1",
                tool_name=tool_name,
                context_id=context_id,
                status="success",
                output={"result": "success"},
                execution_time_ms=100.0
            )
        else:
            return ToolExecutionResponse(
                execution_id="exec-2",
                tool_name=tool_name,
                context_id=context_id,
                status="error",
                error="Tool failed",
                execution_time_ms=50.0
            )
    
    mock_tool_registry.execute.side_effect = mock_execute
    
    workflow = WorkflowSpec(
        name="test_sequential_error",
        mode="sequential",
        steps=[
            WorkflowStep(tool="tool1", input={}),
            WorkflowStep(tool="tool2", input={}),
            WorkflowStep(tool="tool3", input={})
        ],
        timeout_seconds=300,
        on_error="stop"
    )
    
    result = await orchestrator.execute_workflow("test-workflow-context", workflow)
    
    assert result.status == "partial"
    assert result.steps_completed == 1
    assert result.steps_failed == 1


# ============================================================================
# Parallel Workflow Tests
# ============================================================================

@pytest.mark.asyncio
async def test_parallel_workflow_success(orchestrator, mock_redis_client, mock_tool_registry, sample_context):
    """Test successful parallel workflow execution"""
    mock_redis_client.get_context.return_value = sample_context
    
    from models import ToolExecutionResponse
    mock_tool_registry.execute.return_value = ToolExecutionResponse(
        execution_id="exec-1",
        tool_name="test_tool",
        context_id="test-workflow-context",
        status="success",
        output={"result": "success"},
        execution_time_ms=100.0
    )
    
    workflow = WorkflowSpec(
        name="test_parallel",
        mode="parallel",
        steps=[
            WorkflowStep(tool=f"tool{i}", input={"param": f"value{i}"})
            for i in range(5)
        ],
        max_concurrent=3,
        timeout_seconds=300,
        on_error="continue"
    )
    
    result = await orchestrator.execute_workflow("test-workflow-context", workflow)
    
    assert result.status == "completed"
    assert result.steps_completed == 5
    assert result.steps_failed == 0


@pytest.mark.asyncio
async def test_parallel_workflow_with_partial_failure(orchestrator, mock_redis_client, mock_tool_registry, sample_context):
    """Test parallel workflow with some failures"""
    mock_redis_client.get_context.return_value = sample_context
    
    from models import ToolExecutionResponse
    
    call_count = 0
    async def mock_execute(tool_name, context_id, input_data, timeout_override):
        nonlocal call_count
        call_count += 1
        
        # Fail every other execution
        if call_count % 2 == 0:
            return ToolExecutionResponse(
                execution_id=f"exec-{call_count}",
                tool_name=tool_name,
                context_id=context_id,
                status="error",
                error="Simulated error",
                execution_time_ms=50.0
            )
        else:
            return ToolExecutionResponse(
                execution_id=f"exec-{call_count}",
                tool_name=tool_name,
                context_id=context_id,
                status="success",
                output={"result": "success"},
                execution_time_ms=100.0
            )
    
    mock_tool_registry.execute.side_effect = mock_execute
    
    workflow = WorkflowSpec(
        name="test_parallel_partial",
        mode="parallel",
        steps=[WorkflowStep(tool=f"tool{i}", input={}) for i in range(6)],
        max_concurrent=3,
        timeout_seconds=300,
        on_error="continue"
    )
    
    result = await orchestrator.execute_workflow("test-workflow-context", workflow)
    
    assert result.status == "partial"
    assert result.steps_completed == 3
    assert result.steps_failed == 3


# ============================================================================
# DAG Workflow Tests
# ============================================================================

@pytest.mark.asyncio
async def test_dag_workflow_simple(orchestrator, mock_redis_client, mock_tool_registry, sample_context):
    """Test simple DAG workflow"""
    mock_redis_client.get_context.return_value = sample_context
    
    from models import ToolExecutionResponse
    mock_tool_registry.execute.return_value = ToolExecutionResponse(
        execution_id="exec-1",
        tool_name="test_tool",
        context_id="test-workflow-context",
        status="success",
        output={"result": "success"},
        execution_time_ms=100.0
    )
    
    # DAG: step0 -> step1, step2 -> step3
    workflow = WorkflowSpec(
        name="test_dag",
        mode="dag",
        steps=[
            WorkflowStep(tool="tool0", input={}, depends_on=[]),
            WorkflowStep(tool="tool1", input={}, depends_on=["step_0"]),
            WorkflowStep(tool="tool2", input={}, depends_on=["step_0"]),
            WorkflowStep(tool="tool3", input={}, depends_on=["step_1", "step_2"])
        ],
        timeout_seconds=300,
        on_error="stop"
    )
    
    result = await orchestrator.execute_workflow("test-workflow-context", workflow)
    
    assert result.status == "completed"
    assert result.steps_completed == 4


# ============================================================================
# Workflow Status Tests
# ============================================================================

@pytest.mark.asyncio
async def test_get_workflow_status(orchestrator, mock_redis_client, sample_context):
    """Test getting workflow status"""
    # Add some agent logs to context
    from models import AgentLog
    sample_context.agent_logs = [
        AgentLog(
            agent="tool1",
            step="step_1",
            status="success",
            execution_time_ms=100.0
        ),
        AgentLog(
            agent="tool2",
            step="step_2",
            status="success",
            execution_time_ms=150.0
        )
    ]
    
    mock_redis_client.get_context.return_value = sample_context
    
    status = await orchestrator.get_workflow_status("test-workflow-context")
    
    assert status["context_id"] == "test-workflow-context"
    assert status["total_steps"] == 2
    assert status["successful_steps"] == 2
    assert status["failed_steps"] == 0
    assert len(status["recent_logs"]) == 2
