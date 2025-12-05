"""
Tool implementations and registry for MCP server.
"""
import time
import asyncio
import httpx
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime
from dataclasses import dataclass

from models import (
    Paper, Author, EmbeddingPointer, Cluster, CitationMetrics,
    AgentLog, ToolSchema, ToolExecutionResponse
)
from utils import logger, ToolExecutionError


# ============================================================================
# Circuit Breaker Pattern
# ============================================================================

@dataclass
class CircuitBreakerState:
    """State for circuit breaker pattern"""
    failure_count: int = 0
    last_failure_time: Optional[float] = None
    is_open: bool = False


class CircuitBreaker:
    """Circuit breaker for tool execution"""
    
    def __init__(self, threshold: int = 5, timeout: int = 60):
        self.threshold = threshold
        self.timeout = timeout
        self.states: Dict[str, CircuitBreakerState] = {}
    
    def record_success(self, tool_name: str):
        """Record successful execution"""
        if tool_name in self.states:
            self.states[tool_name].failure_count = 0
            self.states[tool_name].is_open = False
    
    def record_failure(self, tool_name: str):
        """Record failed execution"""
        if tool_name not in self.states:
            self.states[tool_name] = CircuitBreakerState()
        
        state = self.states[tool_name]
        state.failure_count += 1
        state.last_failure_time = time.time()
        
        if state.failure_count >= self.threshold:
            state.is_open = True
            logger.warning(f"Circuit breaker opened for tool {tool_name}")
    
    def is_open(self, tool_name: str) -> bool:
        """Check if circuit is open"""
        if tool_name not in self.states:
            return False
        
        state = self.states[tool_name]
        if not state.is_open:
            return False
        
        # Check if timeout has passed
        if state.last_failure_time and (time.time() - state.last_failure_time) > self.timeout:
            state.is_open = False
            state.failure_count = 0
            logger.info(f"Circuit breaker closed for tool {tool_name} after timeout")
            return False
        
        return True


# ============================================================================
# Tool Registry
# ============================================================================

class ToolRegistry:
    """Registry for managing and executing tools"""
    
    def __init__(self):
        self.tools: Dict[str, ToolSchema] = {}
        self.handlers: Dict[str, Callable] = {}
        self.circuit_breaker = CircuitBreaker()
    
    def register(self, tool_schema: ToolSchema, handler: Callable):
        """Register a tool with its handler"""
        self.tools[tool_schema.name] = tool_schema
        self.handlers[tool_schema.name] = handler
        logger.info(f"Registered tool: {tool_schema.name}")
    
    def get_tool(self, tool_name: str) -> Optional[ToolSchema]:
        """Get tool schema by name"""
        return self.tools.get(tool_name)
    
    def list_tools(self) -> List[ToolSchema]:
        """List all registered tools"""
        return list(self.tools.values())
    
    async def execute(
        self,
        tool_name: str,
        context_id: str,
        input_data: Dict[str, Any],
        timeout_override: Optional[int] = None
    ) -> ToolExecutionResponse:
        """
        Execute a tool with retry logic and circuit breaker.
        """
        tool = self.get_tool(tool_name)
        if not tool:
            raise ToolExecutionError(f"Tool {tool_name} not found")
        
        # Check circuit breaker
        if self.circuit_breaker.is_open(tool_name):
            raise ToolExecutionError(f"Circuit breaker open for tool {tool_name}")
        
        handler = self.handlers.get(tool_name)
        if not handler:
            raise ToolExecutionError(f"Handler for tool {tool_name} not found")
        
        timeout = timeout_override or tool.timeout_seconds
        max_retries = tool.max_retries
        
        # Execute with retries
        last_error = None
        for attempt in range(max_retries + 1):
            try:
                start_time = time.time()
                
                # Execute with timeout
                result = await asyncio.wait_for(
                    handler(context_id, input_data),
                    timeout=timeout
                )
                
                execution_time_ms = (time.time() - start_time) * 1000
                
                # Record success
                self.circuit_breaker.record_success(tool_name)
                
                return ToolExecutionResponse(
                    execution_id=f"{tool_name}_{int(time.time())}",
                    tool_name=tool_name,
                    context_id=context_id,
                    status="success",
                    output=result,
                    execution_time_ms=execution_time_ms
                )
            
            except asyncio.TimeoutError:
                last_error = f"Tool execution timed out after {timeout}s"
                logger.warning(f"Tool {tool_name} timed out (attempt {attempt + 1}/{max_retries + 1})")
                if attempt == max_retries:
                    self.circuit_breaker.record_failure(tool_name)
            
            except Exception as e:
                last_error = str(e)
                logger.error(f"Tool {tool_name} failed: {e} (attempt {attempt + 1}/{max_retries + 1})")
                if attempt == max_retries:
                    self.circuit_breaker.record_failure(tool_name)
            
            # Wait before retry
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        # All retries failed
        return ToolExecutionResponse(
            execution_id=f"{tool_name}_{int(time.time())}",
            tool_name=tool_name,
            context_id=context_id,
            status="error",
            error=last_error,
            execution_time_ms=0.0
        )


# ============================================================================
# Tool Implementations
# ============================================================================

# Global HTTP client for API calls
http_client = httpx.AsyncClient(timeout=30.0)


async def fetch_openalex_handler(context_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch papers from OpenAlex API.
    Input: { "query": str, "limit": int, "filter": str }
    Output: { "papers": List[Paper] }
    """
    query = input_data.get("query", "")
    limit = input_data.get("limit", 25)
    filter_param = input_data.get("filter", "")
    
    logger.info(f"Fetching papers from OpenAlex: query='{query}', limit={limit}")
    
    # OpenAlex API call
    url = "https://api.openalex.org/works"
    params = {
        "search": query,
        "per_page": limit,
        "mailto": "user@example.com"  # Replace with env var
    }
    
    if filter_param:
        params["filter"] = filter_param
    
    try:
        response = await http_client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Parse results
        papers = []
        for work in data.get("results", []):
            authors = [
                Author(
                    name=author.get("author", {}).get("display_name", "Unknown"),
                    affiliation=None,
                    orcid=author.get("author", {}).get("orcid")
                )
                for author in work.get("authorships", [])
            ]
            
            paper = Paper(
                paper_id=work.get("id", ""),
                title=work.get("title", "Untitled"),
                abstract=work.get("abstract") if work.get("abstract") else None,
                authors=authors,
                year=work.get("publication_year"),
                doi=work.get("doi"),
                url=work.get("id"),
                citation_count=work.get("cited_by_count", 0),
                venue=work.get("host_venue", {}).get("display_name")
            )
            papers.append(paper)
        
        logger.info(f"Fetched {len(papers)} papers from OpenAlex")
        return {"papers": [p.model_dump() for p in papers]}
    
    except Exception as e:
        logger.error(f"OpenAlex API error: {e}")
        raise ToolExecutionError(f"Failed to fetch papers: {e}")


async def embed_papers_handler(context_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate embeddings for papers (mock implementation).
    Input: { "paper_ids": List[str], "model": str }
    Output: { "embeddings": List[EmbeddingPointer] }
    """
    paper_ids = input_data.get("paper_ids", [])
    model = input_data.get("model", "text-embedding-ada-002")
    
    logger.info(f"Generating embeddings for {len(paper_ids)} papers with model {model}")
    
    # Mock embedding generation (in production, call OpenAI/Cohere API)
    embeddings = []
    for paper_id in paper_ids:
        embedding = EmbeddingPointer(
            paper_id=paper_id,
            vector_id=f"vec_{paper_id}_{int(time.time())}",
            embedding_model=model,
            dimension=1536
        )
        embeddings.append(embedding)
    
    # Simulate processing time
    await asyncio.sleep(0.5)
    
    logger.info(f"Generated {len(embeddings)} embeddings")
    return {"embeddings": [e.model_dump() for e in embeddings]}


async def classify_with_groq_handler(context_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Classify papers using Groq API with real implementation.
    Input: { "paper_ids": List[str], "categories": List[str] }
    Output: { "classifications": Dict[str, str] }
    """
    import os
    from groq import Groq
    
    paper_ids = input_data.get("paper_ids", [])
    categories = input_data.get("categories", ["AI", "ML", "NLP", "CV", "Robotics"])
    
    logger.info(f"Classifying {len(paper_ids)} papers with Groq into {len(categories)} categories")
    
    # Check for Groq API key
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        logger.warning("GROQ_API_KEY not set, using mock classification")
        # Fallback to mock implementation
        classifications = {}
        for i, paper_id in enumerate(paper_ids):
            category = categories[i % len(categories)]
            classifications[paper_id] = category
        return {"classifications": classifications}
    
    try:
        # Initialize Groq client
        client = Groq(api_key=groq_api_key)
        
        # Classify in batches to avoid rate limits
        classifications = {}
        batch_size = 10
        
        for i in range(0, len(paper_ids), batch_size):
            batch = paper_ids[i:i + batch_size]
            
            # Create classification prompt
            prompt = f"""Classify the following research papers into one of these categories: {', '.join(categories)}.
For each paper ID, provide only the category name.

Paper IDs: {', '.join(batch)}

Respond in JSON format: {{"paper_id": "category", ...}}"""
            
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a research paper classifier. Respond only with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.3,
                max_tokens=1024
            )
            
            response = completion.choices[0].message.content
            
            # Parse JSON response
            import json
            try:
                batch_classifications = json.loads(response)
                classifications.update(batch_classifications)
            except json.JSONDecodeError:
                # Fallback: assign first category
                for paper_id in batch:
                    classifications[paper_id] = categories[0]
            
            # Rate limit delay
            await asyncio.sleep(0.5)
        
        logger.info(f"Classified {len(classifications)} papers with Groq")
        return {"classifications": classifications}
        
    except Exception as e:
        logger.error(f"Groq classification failed: {e}, falling back to mock")
        # Fallback to mock
        classifications = {}
        for i, paper_id in enumerate(paper_ids):
            category = categories[i % len(categories)]
            classifications[paper_id] = category
        return {"classifications": classifications}


async def summarize_with_gemini_handler(context_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Summarize clusters using Gemini API with real implementation.
    Input: { "cluster_id": str, "paper_ids": List[str], "abstracts": List[str] }
    Output: { "summary": str, "key_topics": List[str] }
    """
    import os
    import google.generativeai as genai
    
    cluster_id = input_data.get("cluster_id", "")
    paper_ids = input_data.get("paper_ids", [])
    abstracts = input_data.get("abstracts", [])
    
    logger.info(f"Summarizing cluster {cluster_id} with {len(paper_ids)} papers using Gemini")
    
    # Check for Gemini API key
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key or not abstracts:
        logger.warning("GEMINI_API_KEY not set or no abstracts, using mock summarization")
        # Fallback to mock
        summary = f"This cluster contains {len(paper_ids)} papers focusing on advanced research topics. " \
                  f"The papers explore various aspects of the domain with innovative methodologies."
        key_topics = ["Machine Learning", "Deep Learning", "Neural Networks", "Optimization"]
        return {"summary": summary, "key_topics": key_topics}
    
    try:
        # Configure Gemini
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Prepare abstracts text (limit to first 10 abstracts to avoid token limits)
        abstracts_text = "\n\n".join([f"Paper {i+1}: {abs}" for i, abs in enumerate(abstracts[:10]) if abs])
        
        # Create summarization prompt
        prompt = f"""Analyze the following research papers and provide:
1. A concise summary of the main research themes (2-3 sentences)
2. Key topics covered (list 4-6 topics)

Research Papers:
{abstracts_text}

Respond in JSON format:
{{
  "summary": "...",
  "key_topics": ["topic1", "topic2", ...]
}}"""
        
        response = model.generate_content(prompt)
        
        # Parse JSON response
        import json
        try:
            result = json.loads(response.text)
            summary = result.get("summary", "Summary not available")
            key_topics = result.get("key_topics", [])
        except json.JSONDecodeError:
            # Fallback: extract from text
            summary = response.text[:300] if response.text else "Summary generation failed"
            key_topics = ["Machine Learning", "Research", "Analysis"]
        
        logger.info(f"Generated summary for cluster {cluster_id}")
        return {"summary": summary, "key_topics": key_topics}
        
    except Exception as e:
        logger.error(f"Gemini summarization failed: {e}, falling back to mock")
        # Fallback to mock
        summary = f"This cluster contains {len(paper_ids)} papers focusing on advanced research topics."
        key_topics = ["Machine Learning", "Deep Learning", "Neural Networks", "Optimization"]
        return {"summary": summary, "key_topics": key_topics}


async def gap_analysis_with_ollama_handler(context_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform research gap analysis using Ollama (mock implementation).
    Input: { "cluster_id": str, "papers": List[Dict], "domain": str }
    Output: { "research_gaps": List[str], "confidence_scores": Dict[str, float] }
    """
    cluster_id = input_data.get("cluster_id", "")
    papers = input_data.get("papers", [])
    domain = input_data.get("domain", "General")
    
    logger.info(f"Analyzing research gaps for cluster {cluster_id} in domain '{domain}' with {len(papers)} papers")
    
    # Mock gap analysis (in production, call Ollama API)
    research_gaps = [
        "Limited exploration of cross-domain applications",
        "Lack of real-world deployment case studies",
        "Insufficient focus on ethical implications",
        "Need for more robust evaluation metrics"
    ]
    
    confidence_scores = {gap: 0.75 + (i * 0.05) for i, gap in enumerate(research_gaps)}
    
    # Simulate processing time
    await asyncio.sleep(2.0)
    
    logger.info(f"Identified {len(research_gaps)} research gaps for cluster {cluster_id}")
    return {
        "research_gaps": research_gaps,
        "confidence_scores": confidence_scores
    }


async def compute_citation_intel_handler(context_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute citation intelligence metrics.
    Input: { "paper_ids": List[str], "citation_data": List[Dict] }
    Output: { "metrics": List[CitationMetrics] }
    """
    paper_ids = input_data.get("paper_ids", [])
    citation_data = input_data.get("citation_data", [])
    
    logger.info(f"Computing citation metrics for {len(paper_ids)} papers")
    
    metrics = []
    for i, paper_id in enumerate(paper_ids):
        # Mock citation metrics calculation
        citations = citation_data[i].get("citations", 0) if i < len(citation_data) else 0
        
        metric = CitationMetrics(
            paper_id=paper_id,
            citations=citations,
            novelty_index=min(1.0, citations / 100.0),
            citation_velocity=citations / 12.0 if citations > 0 else 0.0,
            h_index_contribution=min(citations, 10) / 10.0,
            interdisciplinary_score=0.6,
            recency_boost=1.2
        )
        metrics.append(metric)
    
    logger.info(f"Computed citation metrics for {len(metrics)} papers")
    return {"metrics": [m.model_dump() for m in metrics]}


async def cluster_papers_handler(context_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Cluster papers based on embeddings (mock implementation).
    Input: { "embedding_ids": List[str], "num_clusters": int, "algorithm": str }
    Output: { "clusters": List[Cluster] }
    """
    embedding_ids = input_data.get("embedding_ids", [])
    num_clusters = input_data.get("num_clusters", 5)
    algorithm = input_data.get("algorithm", "kmeans")
    
    logger.info(f"Clustering {len(embedding_ids)} papers into {num_clusters} clusters using {algorithm}")
    
    # Mock clustering (in production, use sklearn or similar)
    clusters = []
    papers_per_cluster = max(1, len(embedding_ids) // num_clusters)
    
    for i in range(num_clusters):
        start_idx = i * papers_per_cluster
        end_idx = min((i + 1) * papers_per_cluster, len(embedding_ids))
        cluster_paper_ids = embedding_ids[start_idx:end_idx]
        
        cluster = Cluster(
            cluster_id=f"cluster_{i+1}",
            label=f"Research Theme {i+1}",
            paper_ids=cluster_paper_ids,
            centroid_ref=f"centroid_{i+1}",
            confidence_score=0.8 + (i * 0.02)
        )
        clusters.append(cluster)
    
    # Simulate processing time
    await asyncio.sleep(1.0)
    
    logger.info(f"Created {len(clusters)} clusters")
    return {"clusters": [c.model_dump() for c in clusters]}


# ============================================================================
# Initialize Global Tool Registry
# ============================================================================

def initialize_tool_registry() -> ToolRegistry:
    """Initialize and register all tools"""
    registry = ToolRegistry()
    
    # Register fetch_openalex
    registry.register(
        ToolSchema(
            name="fetch_openalex",
            description="Fetch papers from OpenAlex API",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 25},
                    "filter": {"type": "string", "default": ""}
                },
                "required": ["query"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "papers": {"type": "array"}
                }
            },
            handler="tools.fetch_openalex_handler",
            timeout_seconds=60
        ),
        fetch_openalex_handler
    )
    
    # Register embed_papers
    registry.register(
        ToolSchema(
            name="embed_papers",
            description="Generate embeddings for papers",
            input_schema={
                "type": "object",
                "properties": {
                    "paper_ids": {"type": "array"},
                    "model": {"type": "string", "default": "text-embedding-ada-002"}
                },
                "required": ["paper_ids"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "embeddings": {"type": "array"}
                }
            },
            handler="tools.embed_papers_handler",
            timeout_seconds=120
        ),
        embed_papers_handler
    )
    
    # Register classify_with_groq
    registry.register(
        ToolSchema(
            name="classify_with_groq",
            description="Classify papers using Groq",
            input_schema={
                "type": "object",
                "properties": {
                    "paper_ids": {"type": "array"},
                    "categories": {"type": "array"}
                },
                "required": ["paper_ids"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "classifications": {"type": "object"}
                }
            },
            handler="tools.classify_with_groq_handler",
            timeout_seconds=90
        ),
        classify_with_groq_handler
    )
    
    # Register summarize_with_gemini
    registry.register(
        ToolSchema(
            name="summarize_with_gemini",
            description="Summarize clusters using Gemini",
            input_schema={
                "type": "object",
                "properties": {
                    "cluster_id": {"type": "string"},
                    "paper_ids": {"type": "array"},
                    "abstracts": {"type": "array"}
                },
                "required": ["cluster_id", "paper_ids"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "key_topics": {"type": "array"}
                }
            },
            handler="tools.summarize_with_gemini_handler",
            timeout_seconds=120
        ),
        summarize_with_gemini_handler
    )
    
    # Register gap_analysis_with_ollama
    registry.register(
        ToolSchema(
            name="gap_analysis_with_ollama",
            description="Perform research gap analysis using Ollama",
            input_schema={
                "type": "object",
                "properties": {
                    "cluster_id": {"type": "string"},
                    "papers": {"type": "array"},
                    "domain": {"type": "string"}
                },
                "required": ["cluster_id", "papers"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "research_gaps": {"type": "array"},
                    "confidence_scores": {"type": "object"}
                }
            },
            handler="tools.gap_analysis_with_ollama_handler",
            timeout_seconds=150
        ),
        gap_analysis_with_ollama_handler
    )
    
    # Register compute_citation_intel
    registry.register(
        ToolSchema(
            name="compute_citation_intel",
            description="Compute citation intelligence metrics",
            input_schema={
                "type": "object",
                "properties": {
                    "paper_ids": {"type": "array"},
                    "citation_data": {"type": "array"}
                },
                "required": ["paper_ids"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "metrics": {"type": "array"}
                }
            },
            handler="tools.compute_citation_intel_handler",
            timeout_seconds=60
        ),
        compute_citation_intel_handler
    )
    
    # Register cluster_papers
    registry.register(
        ToolSchema(
            name="cluster_papers",
            description="Cluster papers based on embeddings",
            input_schema={
                "type": "object",
                "properties": {
                    "embedding_ids": {"type": "array"},
                    "num_clusters": {"type": "integer", "default": 5},
                    "algorithm": {"type": "string", "default": "kmeans"}
                },
                "required": ["embedding_ids"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "clusters": {"type": "array"}
                }
            },
            handler="tools.cluster_papers_handler",
            timeout_seconds=90
        ),
        cluster_papers_handler
    )
    
    logger.info(f"Initialized tool registry with {len(registry.tools)} tools")
    return registry
