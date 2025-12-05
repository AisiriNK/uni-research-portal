"""
Workflow orchestration engine for MCP server.
Supports sequential, parallel, and DAG-based execution modes.
"""
import asyncio
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
from collections import defaultdict

from models import (
    WorkflowSpec, WorkflowStep, WorkflowExecutionResponse,
    ToolExecutionResponse, AgentLog, ResearchContext
)
from tools import ToolRegistry
from utils import logger, WorkflowExecutionError, RedisClient


class WorkflowOrchestrator:
    """Orchestrates multi-step workflows across tools"""
    
    def __init__(self, tool_registry: ToolRegistry, redis_client: RedisClient):
        self.tool_registry = tool_registry
        self.redis_client = redis_client
    
    async def execute_workflow(
        self,
        context_id: str,
        workflow: WorkflowSpec
    ) -> WorkflowExecutionResponse:
        """
        Execute a complete workflow based on the mode.
        """
        logger.info(f"Starting workflow '{workflow.name}' for context {context_id} in mode '{workflow.mode}'")
        
        started_at = datetime.utcnow()
        start_time = time.time()
        
        try:
            # Route to appropriate execution mode
            if workflow.mode == "sequential":
                results = await self._execute_sequential(context_id, workflow)
            elif workflow.mode == "parallel":
                results = await self._execute_parallel(context_id, workflow)
            elif workflow.mode == "dag":
                results = await self._execute_dag(context_id, workflow)
            else:
                raise WorkflowExecutionError(f"Unknown workflow mode: {workflow.mode}")
            
            # Calculate stats
            completed_at = datetime.utcnow()
            execution_time_ms = (time.time() - start_time) * 1000
            
            steps_completed = len([r for r in results if r.status == "success"])
            steps_failed = len([r for r in results if r.status == "error"])
            
            status = "completed" if steps_failed == 0 else "partial" if steps_completed > 0 else "failed"
            
            logger.info(f"Workflow '{workflow.name}' {status}: {steps_completed}/{len(workflow.steps)} steps completed")
            
            return WorkflowExecutionResponse(
                execution_id=f"workflow_{context_id}_{int(time.time())}",
                context_id=context_id,
                workflow_name=workflow.name,
                status=status,
                steps_completed=steps_completed,
                steps_total=len(workflow.steps),
                steps_failed=steps_failed,
                started_at=started_at,
                completed_at=completed_at,
                execution_time_ms=execution_time_ms,
                results=results
            )
        
        except Exception as e:
            logger.error(f"Workflow '{workflow.name}' failed: {e}")
            execution_time_ms = (time.time() - start_time) * 1000
            
            return WorkflowExecutionResponse(
                execution_id=f"workflow_{context_id}_{int(time.time())}",
                context_id=context_id,
                workflow_name=workflow.name,
                status="failed",
                steps_completed=0,
                steps_total=len(workflow.steps),
                steps_failed=len(workflow.steps),
                started_at=started_at,
                completed_at=datetime.utcnow(),
                execution_time_ms=execution_time_ms,
                results=[]
            )
    
    async def _execute_sequential(
        self,
        context_id: str,
        workflow: WorkflowSpec
    ) -> List[ToolExecutionResponse]:
        """
        Execute workflow steps sequentially.
        Each step waits for previous to complete.
        """
        results = []
        context = await self.redis_client.get_context(context_id)
        
        if not context:
            raise WorkflowExecutionError(f"Context {context_id} not found")
        
        for i, step in enumerate(workflow.steps):
            logger.info(f"Executing step {i+1}/{len(workflow.steps)}: {step.tool}")
            
            try:
                # Execute tool
                result = await self.tool_registry.execute(
                    tool_name=step.tool,
                    context_id=context_id,
                    input_data=step.input,
                    timeout_override=None
                )
                
                results.append(result)
                
                # Log execution in context
                agent_log = AgentLog(
                    agent=step.tool,
                    step=f"step_{i+1}",
                    input_summary=str(step.input)[:200],
                    output_summary=str(result.output)[:200] if result.output else "",
                    status=result.status,
                    error_message=result.error,
                    execution_time_ms=result.execution_time_ms
                )
                
                # Update context with agent log
                context.agent_logs.append(agent_log)
                context.last_updated = datetime.utcnow()
                
                # Update context in Redis
                await self.redis_client.set_context(context_id, context)
                
                # Handle errors based on on_error policy
                if result.status == "error":
                    if workflow.on_error == "stop":
                        logger.warning(f"Stopping workflow due to error in step {i+1}")
                        break
                    elif workflow.on_error == "continue":
                        logger.warning(f"Continuing workflow despite error in step {i+1}")
                        continue
                    elif workflow.on_error == "retry":
                        logger.info(f"Retrying step {i+1} due to error")
                        # Retry logic already handled in tool_registry.execute
                        continue
                
            except asyncio.TimeoutError:
                logger.error(f"Step {i+1} timed out")
                result = ToolExecutionResponse(
                    execution_id=f"{step.tool}_{int(time.time())}",
                    tool_name=step.tool,
                    context_id=context_id,
                    status="timeout",
                    error="Step execution timed out",
                    execution_time_ms=0.0
                )
                results.append(result)
                
                if workflow.on_error == "stop":
                    break
            
            except Exception as e:
                logger.error(f"Step {i+1} failed with exception: {e}")
                result = ToolExecutionResponse(
                    execution_id=f"{step.tool}_{int(time.time())}",
                    tool_name=step.tool,
                    context_id=context_id,
                    status="error",
                    error=str(e),
                    execution_time_ms=0.0
                )
                results.append(result)
                
                if workflow.on_error == "stop":
                    break
        
        return results
    
    async def _execute_parallel(
        self,
        context_id: str,
        workflow: WorkflowSpec
    ) -> List[ToolExecutionResponse]:
        """
        Execute workflow steps in parallel.
        All steps run concurrently up to max_concurrent limit.
        """
        results = []
        context = await self.redis_client.get_context(context_id)
        
        if not context:
            raise WorkflowExecutionError(f"Context {context_id} not found")
        
        # Execute all steps in parallel with concurrency limit
        semaphore = asyncio.Semaphore(workflow.max_concurrent)
        
        async def execute_step_with_semaphore(i: int, step: WorkflowStep):
            async with semaphore:
                logger.info(f"Executing parallel step {i+1}: {step.tool}")
                try:
                    result = await self.tool_registry.execute(
                        tool_name=step.tool,
                        context_id=context_id,
                        input_data=step.input,
                        timeout_override=None
                    )
                    
                    # Log execution
                    agent_log = AgentLog(
                        agent=step.tool,
                        step=f"parallel_step_{i+1}",
                        input_summary=str(step.input)[:200],
                        output_summary=str(result.output)[:200] if result.output else "",
                        status=result.status,
                        error_message=result.error,
                        execution_time_ms=result.execution_time_ms
                    )
                    
                    # Thread-safe context update
                    context.agent_logs.append(agent_log)
                    
                    return result
                
                except Exception as e:
                    logger.error(f"Parallel step {i+1} failed: {e}")
                    return ToolExecutionResponse(
                        execution_id=f"{step.tool}_{int(time.time())}",
                        tool_name=step.tool,
                        context_id=context_id,
                        status="error",
                        error=str(e),
                        execution_time_ms=0.0
                    )
        
        # Execute all steps
        tasks = [execute_step_with_semaphore(i, step) for i, step in enumerate(workflow.steps)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to error responses
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(
                    ToolExecutionResponse(
                        execution_id=f"error_{int(time.time())}",
                        tool_name=workflow.steps[i].tool,
                        context_id=context_id,
                        status="error",
                        error=str(result),
                        execution_time_ms=0.0
                    )
                )
            else:
                processed_results.append(result)
        
        # Update context once with all logs
        context.last_updated = datetime.utcnow()
        await self.redis_client.set_context(context_id, context)
        
        return processed_results
    
    async def _execute_dag(
        self,
        context_id: str,
        workflow: WorkflowSpec
    ) -> List[ToolExecutionResponse]:
        """
        Execute workflow as a Directed Acyclic Graph.
        Steps are executed based on dependency resolution.
        """
        results: Dict[str, ToolExecutionResponse] = {}
        context = await self.redis_client.get_context(context_id)
        
        if not context:
            raise WorkflowExecutionError(f"Context {context_id} not found")
        
        # Build dependency graph
        step_map = {f"step_{i}": step for i, step in enumerate(workflow.steps)}
        in_degree = defaultdict(int)
        dependents = defaultdict(list)
        
        for step_id, step in step_map.items():
            for dep in step.depends_on:
                in_degree[step_id] += 1
                dependents[dep].append(step_id)
        
        # Find steps with no dependencies
        queue = [step_id for step_id in step_map if in_degree[step_id] == 0]
        
        if not queue:
            raise WorkflowExecutionError("No steps with zero dependencies found - possible cycle in DAG")
        
        executed_count = 0
        
        while queue:
            # Execute all ready steps in parallel
            current_batch = queue[:]
            queue = []
            
            logger.info(f"Executing DAG batch with {len(current_batch)} steps")
            
            async def execute_dag_step(step_id: str):
                step = step_map[step_id]
                logger.info(f"Executing DAG step {step_id}: {step.tool}")
                
                try:
                    result = await self.tool_registry.execute(
                        tool_name=step.tool,
                        context_id=context_id,
                        input_data=step.input,
                        timeout_override=None
                    )
                    
                    # Log execution
                    agent_log = AgentLog(
                        agent=step.tool,
                        step=step_id,
                        input_summary=str(step.input)[:200],
                        output_summary=str(result.output)[:200] if result.output else "",
                        status=result.status,
                        error_message=result.error,
                        execution_time_ms=result.execution_time_ms
                    )
                    
                    context.agent_logs.append(agent_log)
                    
                    return step_id, result
                
                except Exception as e:
                    logger.error(f"DAG step {step_id} failed: {e}")
                    return step_id, ToolExecutionResponse(
                        execution_id=f"{step.tool}_{int(time.time())}",
                        tool_name=step.tool,
                        context_id=context_id,
                        status="error",
                        error=str(e),
                        execution_time_ms=0.0
                    )
            
            # Execute batch
            batch_tasks = [execute_dag_step(step_id) for step_id in current_batch]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Process results
            for batch_result in batch_results:
                if isinstance(batch_result, Exception):
                    logger.error(f"DAG batch execution failed: {batch_result}")
                    continue
                
                step_id, result = batch_result
                results[step_id] = result
                executed_count += 1
                
                # Update in-degree for dependents
                for dependent in dependents[step_id]:
                    in_degree[dependent] -= 1
                    if in_degree[dependent] == 0:
                        queue.append(dependent)
        
        # Update context
        context.last_updated = datetime.utcnow()
        await self.redis_client.set_context(context_id, context)
        
        # Return results in original order
        ordered_results = [results.get(f"step_{i}") for i in range(len(workflow.steps))]
        return [r for r in ordered_results if r is not None]
    
    async def get_workflow_status(self, context_id: str) -> Dict[str, Any]:
        """Get the current status of workflow execution for a context"""
        context = await self.redis_client.get_context(context_id)
        
        if not context:
            raise WorkflowExecutionError(f"Context {context_id} not found")
        
        return {
            "context_id": context_id,
            "status": context.status,
            "total_steps": len(context.agent_logs),
            "successful_steps": len([log for log in context.agent_logs if log.status == "success"]),
            "failed_steps": len([log for log in context.agent_logs if log.status == "error"]),
            "last_updated": context.last_updated.isoformat(),
            "recent_logs": [
                {
                    "agent": log.agent,
                    "step": log.step,
                    "status": log.status,
                    "timestamp": log.timestamp.isoformat()
                }
                for log in context.agent_logs[-5:]
            ]
        }
