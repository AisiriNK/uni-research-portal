"""
MCP (Model Context Protocol) Server - Main Application
Production-ready FastAPI server for orchestrating multi-agent AI workflows.
"""
import os
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from pydantic import BaseModel
from dotenv import load_dotenv

from models import (
    ResearchContext, CreateContextRequest, CreateContextResponse,
    UpdateContextRequest, PaginatedContextResponse,
    ToolSchema, ToolExecutionRequest, ToolExecutionResponse,
    WorkflowExecutionRequest, WorkflowExecutionResponse,
    ExecutionTrace, AgentLog
)
from tools import initialize_tool_registry, ToolRegistry
from orchestrator import WorkflowOrchestrator
from utils import (
    RedisClient, FirestoreClient, setup_logging,
    generate_context_id, validate_context_size, paginate_list,
    ContextNotFoundError, AuthenticationError, logger
)

# Load environment variables
load_dotenv()

# ============================================================================
# Configuration
# ============================================================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
API_KEY = os.getenv("API_KEY", "development-key")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "admin-key")
DEFAULT_TTL = int(os.getenv("DEFAULT_CONTEXT_TTL", "3600"))
ENABLE_FIRESTORE = os.getenv("ENABLE_FIRESTORE_PERSISTENCE", "false").lower() == "true"
FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID", "")
FIRESTORE_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

# Setup logging
logger = setup_logging(os.getenv("LOG_LEVEL", "INFO"))

# ============================================================================
# Prometheus Metrics
# ============================================================================

context_created = Counter('mcp_context_created_total', 'Total contexts created')
context_retrieved = Counter('mcp_context_retrieved_total', 'Total contexts retrieved')
context_updated = Counter('mcp_context_updated_total', 'Total contexts updated')
tool_executed = Counter('mcp_tool_executed_total', 'Total tool executions', ['tool_name', 'status'])
workflow_executed = Counter('mcp_workflow_executed_total', 'Total workflow executions', ['workflow_name', 'status'])
request_duration = Histogram('mcp_request_duration_seconds', 'Request duration', ['endpoint'])

# ============================================================================
# Global State
# ============================================================================

redis_client: Optional[RedisClient] = None
firestore_client: Optional[FirestoreClient] = None
tool_registry: Optional[ToolRegistry] = None
orchestrator: Optional[WorkflowOrchestrator] = None

# ============================================================================
# Lifespan Management
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global redis_client, firestore_client, tool_registry, orchestrator
    
    # Startup
    logger.info("Starting MCP Server...")
    
    # Initialize Redis
    redis_client = RedisClient(REDIS_URL, REDIS_PASSWORD)
    await redis_client.connect()
    
    # Initialize Firestore (optional)
    if ENABLE_FIRESTORE and FIRESTORE_PROJECT_ID:
        firestore_client = FirestoreClient(FIRESTORE_PROJECT_ID, FIRESTORE_CREDENTIALS)
        firestore_client.connect()
        logger.info("Firestore persistence enabled")
    
    # Initialize tool registry
    tool_registry = initialize_tool_registry()
    
    # Initialize orchestrator
    orchestrator = WorkflowOrchestrator(tool_registry, redis_client)
    
    logger.info("MCP Server started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down MCP Server...")
    await redis_client.disconnect()
    logger.info("MCP Server stopped")

# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="MCP Server",
    description="Model Context Protocol Server for Multi-Agent AI Workflows",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Authentication
# ============================================================================

async def verify_api_key(x_api_key: str = Header(...)):
    """Verify API key from header"""
    if x_api_key != API_KEY:
        logger.warning(f"Invalid API key attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    return x_api_key

async def verify_admin_key(x_api_key: str = Header(...)):
    """Verify admin API key from header"""
    if x_api_key != ADMIN_API_KEY:
        logger.warning(f"Invalid admin API key attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin API key"
        )
    return x_api_key

# ============================================================================
# Health & Metrics Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "redis": "connected" if redis_client and redis_client._client else "disconnected",
        "firestore": "enabled" if firestore_client else "disabled"
    }

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

# ============================================================================
# Context Management Endpoints
# ============================================================================

@app.post("/context/create", response_model=CreateContextResponse, dependencies=[Depends(verify_api_key)])
async def create_context(request: CreateContextRequest):
    """Create a new research context"""
    try:
        with request_duration.labels(endpoint='/context/create').time():
            # Generate context ID
            context_id = generate_context_id()
            
            # Create context
            context = ResearchContext(
                context_id=context_id,
                owner_id=request.owner_id,
                query=request.query,
                ttl_seconds=request.ttl_seconds or DEFAULT_TTL,
                metadata=request.metadata or {}
            )
            
            # Validate size
            if not validate_context_size(context):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Context size exceeds maximum limit"
                )
            
            # Store in Redis
            success = await redis_client.set_context(context_id, context)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create context"
                )
            
            # Optionally persist to Firestore
            if firestore_client:
                await firestore_client.save_context(context)
            
            context_created.inc()
            logger.info(f"Created context {context_id} for owner {request.owner_id}")
            
            return CreateContextResponse(
                context_id=context.context_id,
                owner_id=context.owner_id,
                query=context.query,
                created_at=context.created_at,
                ttl=context.ttl_seconds,
                status=context.status
            )
    
    except Exception as e:
        logger.error(f"Error creating context: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/context/{context_id}", response_model=PaginatedContextResponse, dependencies=[Depends(verify_api_key)])
async def get_context(
    context_id: str,
    page: int = 1,
    per_page: int = 50
):
    """Retrieve a context with pagination"""
    try:
        with request_duration.labels(endpoint='/context/get').time():
            # Retrieve from Redis
            context = await redis_client.get_context(context_id)
            
            if not context:
                # Try Firestore if enabled
                if firestore_client:
                    context = await firestore_client.load_context(context_id)
                
                if not context:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Context {context_id} not found"
                    )
            
            # Paginate papers
            paginated_papers, papers_meta = paginate_list(context.papers, page, per_page)
            
            context_retrieved.inc()
            
            return PaginatedContextResponse(
                context_id=context.context_id,
                owner_id=context.owner_id,
                query=context.query,
                created_at=context.created_at,
                last_updated=context.last_updated,
                status=context.status,
                papers=paginated_papers,
                papers_total=papers_meta["total"],
                papers_page=papers_meta["page"],
                papers_per_page=papers_meta["per_page"],
                clusters=context.clusters,
                agent_logs=context.agent_logs[-20:],  # Last 20 logs
                embeddings_count=len(context.embeddings),
                citation_metrics_count=len(context.citation_metrics),
                metadata=context.metadata
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving context {context_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.patch("/context/{context_id}", dependencies=[Depends(verify_api_key)])
async def update_context(context_id: str, updates: UpdateContextRequest):
    """Update a context (partial update)"""
    try:
        with request_duration.labels(endpoint='/context/update').time():
            # Retrieve existing context
            context = await redis_client.get_context(context_id)
            
            if not context:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Context {context_id} not found"
                )
            
            # Apply updates
            update_dict = updates.model_dump(exclude_unset=True)
            
            for key, value in update_dict.items():
                if hasattr(context, key) and value is not None:
                    # Handle list fields (append instead of replace)
                    if key in ["papers", "embeddings", "clusters", "citation_metrics", "agent_logs"]:
                        current_list = getattr(context, key)
                        current_list.extend(value)
                    else:
                        setattr(context, key, value)
            
            # Update timestamp
            context.last_updated = datetime.utcnow()
            
            # Validate size
            if not validate_context_size(context):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Updated context size exceeds maximum limit"
                )
            
            # Store back
            success = await redis_client.set_context(context_id, context)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update context"
                )
            
            # Optionally persist to Firestore
            if firestore_client:
                await firestore_client.save_context(context)
            
            context_updated.inc()
            logger.info(f"Updated context {context_id}")
            
            return {"message": "Context updated successfully", "context_id": context_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating context {context_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ============================================================================
# Tool Management Endpoints
# ============================================================================

@app.post("/tools/register", dependencies=[Depends(verify_admin_key)])
async def register_tool(tool_schema: ToolSchema):
    """Register a new tool (admin only)"""
    try:
        # Note: In production, this would dynamically load the handler
        # For now, tools are pre-registered at startup
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Dynamic tool registration not implemented. Tools are registered at startup."
        )
    except Exception as e:
        logger.error(f"Error registering tool: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/tools/list", dependencies=[Depends(verify_api_key)])
async def list_tools():
    """List all registered tools"""
    try:
        tools = tool_registry.list_tools()
        return {
            "tools": [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "timeout_seconds": tool.timeout_seconds,
                    "tags": tool.tags
                }
                for tool in tools
            ],
            "total": len(tools)
        }
    except Exception as e:
        logger.error(f"Error listing tools: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/tools/execute", response_model=ToolExecutionResponse, dependencies=[Depends(verify_api_key)])
async def execute_tool(request: ToolExecutionRequest):
    """Execute a single tool"""
    try:
        with request_duration.labels(endpoint='/tools/execute').time():
            result = await tool_registry.execute(
                tool_name=request.tool_name,
                context_id=request.context_id,
                input_data=request.input,
                timeout_override=request.timeout_override
            )
            
            tool_executed.labels(tool_name=request.tool_name, status=result.status).inc()
            
            return result
    
    except Exception as e:
        logger.error(f"Error executing tool {request.tool_name}: {e}")
        tool_executed.labels(tool_name=request.tool_name, status="error").inc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ============================================================================
# Workflow Orchestration Endpoints
# ============================================================================

@app.post("/workflow/execute", response_model=WorkflowExecutionResponse, dependencies=[Depends(verify_api_key)])
async def execute_workflow(request: WorkflowExecutionRequest):
    """Execute a complete workflow"""
    try:
        with request_duration.labels(endpoint='/workflow/execute').time():
            result = await orchestrator.execute_workflow(
                context_id=request.context_id,
                workflow=request.workflow
            )
            
            workflow_executed.labels(
                workflow_name=request.workflow.name,
                status=result.status
            ).inc()
            
            logger.info(f"Workflow '{request.workflow.name}' completed with status: {result.status}")
            
            return result
    
    except Exception as e:
        logger.error(f"Error executing workflow: {e}")
        workflow_executed.labels(
            workflow_name=request.workflow.name,
            status="error"
        ).inc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/workflow/status/{context_id}", dependencies=[Depends(verify_api_key)])
async def get_workflow_status(context_id: str):
    """Get workflow execution status for a context"""
    try:
        status_info = await orchestrator.get_workflow_status(context_id)
        return status_info
    except Exception as e:
        logger.error(f"Error getting workflow status for {context_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ============================================================================
# Trace Endpoints
# ============================================================================

@app.get("/context/{context_id}/trace", response_model=ExecutionTrace, dependencies=[Depends(verify_api_key)])
async def get_execution_trace(context_id: str):
    """Get complete execution trace for a context"""
    try:
        context = await redis_client.get_context(context_id)
        
        if not context:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Context {context_id} not found"
            )
        
        total_execution_time = sum(log.execution_time_ms for log in context.agent_logs)
        
        return ExecutionTrace(
            context_id=context.context_id,
            owner_id=context.owner_id,
            query=context.query,
            agent_logs=context.agent_logs,
            total_steps=len(context.agent_logs),
            total_execution_time_ms=total_execution_time,
            status=context.status,
            created_at=context.created_at,
            last_updated=context.last_updated
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trace for {context_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ============================================================================
# Error Handlers
# ============================================================================

@app.exception_handler(ContextNotFoundError)
async def context_not_found_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc)}
    )

@app.exception_handler(AuthenticationError)
async def auth_error_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": str(exc)}
    )

# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("MCP_SERVER_HOST", "0.0.0.0")
    port = int(os.getenv("MCP_SERVER_PORT", "8001"))
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )
