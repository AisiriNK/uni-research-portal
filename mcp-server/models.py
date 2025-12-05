"""
Pydantic models for MCP server context and schemas.
"""
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from uuid import UUID


# ============================================================================
# Paper Models
# ============================================================================

class Author(BaseModel):
    """Author information"""
    name: str
    affiliation: Optional[str] = None
    orcid: Optional[str] = None


class Paper(BaseModel):
    """Academic paper metadata"""
    paper_id: str = Field(..., description="Unique paper identifier (e.g., OpenAlex ID)")
    title: str
    abstract: Optional[str] = None
    authors: List[Author] = []
    year: Optional[int] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    citation_count: int = 0
    venue: Optional[str] = None
    keywords: List[str] = []


# ============================================================================
# Embedding Models
# ============================================================================

class EmbeddingPointer(BaseModel):
    """Pointer to embedding vector storage"""
    paper_id: str
    vector_id: str = Field(..., description="Reference to vector in vector DB")
    embedding_model: str = Field(default="text-embedding-ada-002")
    dimension: int = Field(default=1536)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Cluster Models
# ============================================================================

class Cluster(BaseModel):
    """Research paper cluster"""
    cluster_id: str
    label: str = Field(..., description="Human-readable cluster name")
    paper_ids: List[str] = []
    centroid_ref: Optional[str] = Field(None, description="Reference to centroid vector")
    summary: Optional[str] = None
    key_topics: List[str] = []
    research_gaps: List[str] = []
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)


# ============================================================================
# Citation Intelligence Models
# ============================================================================

class CitationMetrics(BaseModel):
    """Citation intelligence metrics for a paper"""
    paper_id: str
    citations: int = 0
    novelty_index: float = Field(default=0.0, description="0-1 score indicating novelty")
    citation_velocity: float = Field(default=0.0, description="Citations per month")
    h_index_contribution: float = 0.0
    interdisciplinary_score: float = Field(default=0.0, description="Cross-domain citation diversity")
    recency_boost: float = Field(default=1.0, description="Multiplier based on publication date")


# ============================================================================
# Agent Log Models
# ============================================================================

class AgentLog(BaseModel):
    """Log entry for agent execution"""
    log_id: str = Field(default_factory=lambda: str(UUID))
    agent: str = Field(..., description="Agent name (e.g., 'groq_classifier')")
    step: str = Field(..., description="Step name (e.g., 'classify_papers')")
    input_summary: str = Field(default="", description="Summary of input data")
    output_summary: str = Field(default="", description="Summary of output")
    status: str = Field(default="success", description="success|error|timeout")
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# External Signals (Placeholder)
# ============================================================================

class ExternalSignal(BaseModel):
    """External data signals (patents, trends, etc.)"""
    signal_type: str = Field(..., description="weather|trade|patent|trend")
    source: str
    data: Dict[str, Any]
    relevance_score: float = Field(default=0.0, ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Main Context Model
# ============================================================================

class ResearchContext(BaseModel):
    """
    Shared context object for multi-agent research workflows.
    Stored in Redis/Firestore and updated by agents.
    """
    # Metadata
    context_id: str = Field(..., description="UUID of the context")
    owner_id: str = Field(..., description="User/researcher who owns this context")
    query: str = Field(..., description="Original research query")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    ttl_seconds: int = Field(default=3600, description="Time to live in seconds")
    status: str = Field(default="active", description="active|completed|expired")
    
    # Research data
    papers: List[Paper] = Field(default_factory=list)
    embeddings: List[EmbeddingPointer] = Field(default_factory=list)
    clusters: List[Cluster] = Field(default_factory=list)
    citation_metrics: List[CitationMetrics] = Field(default_factory=list)
    
    # External signals (placeholder for future expansion)
    external_signals: List[ExternalSignal] = Field(default_factory=list)
    
    # Agent execution trace
    agent_logs: List[AgentLog] = Field(default_factory=list)
    
    # Workflow state
    workflow_state: Dict[str, Any] = Field(default_factory=dict, description="Custom workflow state")
    
    # Additional metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# ============================================================================
# API Request/Response Models
# ============================================================================

class CreateContextRequest(BaseModel):
    """Request to create a new context"""
    owner_id: str
    query: str
    ttl_seconds: Optional[int] = 3600
    metadata: Optional[Dict[str, Any]] = None


class CreateContextResponse(BaseModel):
    """Response for context creation"""
    context_id: str
    owner_id: str
    query: str
    created_at: datetime
    ttl: int
    status: str


class UpdateContextRequest(BaseModel):
    """Request to update context (partial update)"""
    papers: Optional[List[Paper]] = None
    embeddings: Optional[List[EmbeddingPointer]] = None
    clusters: Optional[List[Cluster]] = None
    citation_metrics: Optional[List[CitationMetrics]] = None
    external_signals: Optional[List[ExternalSignal]] = None
    agent_logs: Optional[List[AgentLog]] = None
    workflow_state: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class PaginatedContextResponse(BaseModel):
    """Paginated context response for large datasets"""
    context_id: str
    owner_id: str
    query: str
    created_at: datetime
    last_updated: datetime
    status: str
    
    # Paginated data
    papers: List[Paper]
    papers_total: int
    papers_page: int
    papers_per_page: int
    
    clusters: List[Cluster]
    agent_logs: List[AgentLog]
    
    # Non-paginated (usually smaller)
    embeddings_count: int
    citation_metrics_count: int
    metadata: Dict[str, Any]


# ============================================================================
# Tool Models
# ============================================================================

class ToolSchema(BaseModel):
    """Schema for tool registration"""
    name: str = Field(..., description="Unique tool identifier")
    description: str
    input_schema: Dict[str, Any] = Field(..., description="JSON schema for input validation")
    output_schema: Dict[str, Any] = Field(..., description="JSON schema for output")
    handler: str = Field(..., description="Python import path to handler function")
    timeout_seconds: int = Field(default=60)
    max_retries: int = Field(default=3)
    circuit_breaker_threshold: int = Field(default=5, description="Failures before circuit opens")
    tags: List[str] = Field(default_factory=list)


class ToolExecutionRequest(BaseModel):
    """Request to execute a tool"""
    tool_name: str
    context_id: str
    input: Dict[str, Any]
    timeout_override: Optional[int] = None


class ToolExecutionResponse(BaseModel):
    """Response from tool execution"""
    execution_id: str
    tool_name: str
    context_id: str
    status: str = Field(..., description="success|error|timeout")
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Workflow Models
# ============================================================================

class WorkflowStep(BaseModel):
    """Single step in a workflow"""
    tool: str = Field(..., description="Tool name to execute")
    input: Dict[str, Any] = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list, description="Step IDs this depends on")
    condition: Optional[str] = Field(None, description="Conditional execution expression")


class WorkflowSpec(BaseModel):
    """Workflow specification"""
    name: str
    mode: str = Field(..., description="sequential|parallel|dag")
    steps: List[WorkflowStep]
    max_concurrent: int = Field(default=5, description="Max parallel executions for parallel mode")
    timeout_seconds: int = Field(default=300)
    on_error: str = Field(default="stop", description="stop|continue|retry")
    retry_failed_steps: int = Field(default=0)


class WorkflowExecutionRequest(BaseModel):
    """Request to execute a workflow"""
    context_id: str
    workflow: WorkflowSpec


class WorkflowExecutionResponse(BaseModel):
    """Response from workflow execution"""
    execution_id: str
    context_id: str
    workflow_name: str
    status: str = Field(..., description="running|completed|failed|partial")
    steps_completed: int
    steps_total: int
    steps_failed: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    execution_time_ms: float = 0.0
    results: List[ToolExecutionResponse] = Field(default_factory=list)


# ============================================================================
# Trace Models
# ============================================================================

class ExecutionTrace(BaseModel):
    """Complete execution trace for a context"""
    context_id: str
    owner_id: str
    query: str
    agent_logs: List[AgentLog]
    total_steps: int
    total_execution_time_ms: float
    status: str
    created_at: datetime
    last_updated: datetime
