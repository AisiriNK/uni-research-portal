"""
Research Hub Backend - FastAPI Application
Integrates OpenAlex API for paper fetching and Groq AI for intelligent clustering
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import json
import os
from datetime import datetime
import logging

# Import utility functions
from utils import (
    fetch_papers_from_openalex,
    generate_clustered_graph_data,
    classify_papers_with_groq,
    Paper,
    ClusterNode,
    ClusterEdge
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Research Hub API",
    description="Backend for research paper clustering and analysis",
    version="1.0.0"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Pydantic models for API responses
class AuthorResponse(BaseModel):
    id: str
    name: str
    affiliation: Optional[str] = None

class ConceptResponse(BaseModel):
    id: str
    name: str
    level: int
    score: float

class PaperResponse(BaseModel):
    id: str
    title: str
    abstract: Optional[str] = None
    authors: List[AuthorResponse]
    year: int
    doi: Optional[str] = None
    url: Optional[str] = None
    citation_count: int
    concepts: List[ConceptResponse]
    venue: Optional[str] = None

class ClusterNodeResponse(BaseModel):
    id: str
    label: str
    level: int
    parent_id: Optional[str] = None
    papers: List[PaperResponse] = Field(default_factory=list)
    paper_count: int = 0

class ClusterEdgeResponse(BaseModel):
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    
    class Config:
        populate_by_name = True

class ClusterResponse(BaseModel):
    nodes: List[ClusterNodeResponse]
    edges: List[ClusterEdgeResponse]

class SearchRequest(BaseModel):
    query: str
    limit: int = Field(default=50, ge=1, le=200)
    year_from: Optional[int] = Field(default=2015, ge=1900)
    year_to: Optional[int] = Field(default=2024, le=2030)

def convert_paper_to_response(paper: Paper) -> PaperResponse:
    """Convert internal Paper object to API response format"""
    return PaperResponse(
        id=paper.id,
        title=paper.title,
        abstract=paper.abstract,
        authors=[AuthorResponse(id=a.id, name=a.name, affiliation=a.affiliation) for a in paper.authors],
        year=paper.year,
        doi=paper.doi,
        url=paper.url,
        citation_count=paper.citation_count,
        concepts=[ConceptResponse(id=c.id, name=c.name, level=c.level, score=c.score) for c in paper.concepts],
        venue=paper.venue
    )

def convert_cluster_data_to_response(cluster_data: Dict[str, Any]) -> ClusterResponse:
    """Convert internal cluster data to API response format"""
    nodes = []
    for node_dict in cluster_data["nodes"]:
        # Convert papers to response format
        papers_response = []
        if "papers" in node_dict and node_dict["papers"]:
            for paper in node_dict["papers"]:
                if hasattr(paper, 'id'):  # Paper object
                    papers_response.append(convert_paper_to_response(paper))
                else:  # Dictionary
                    # Create Paper object from dict first
                    paper_obj = Paper(
                        id=paper.get("id", ""),
                        title=paper.get("title", ""),
                        abstract=paper.get("abstract"),
                        authors=[],  # Simplified for response
                        year=paper.get("year", 0),
                        doi=paper.get("doi"),
                        url=paper.get("url"),
                        citation_count=paper.get("citation_count", 0),
                        concepts=[],  # Simplified for response
                        venue=paper.get("venue")
                    )
                    papers_response.append(convert_paper_to_response(paper_obj))
        
        node_response = ClusterNodeResponse(
            id=node_dict["id"],
            label=node_dict["label"],
            level=node_dict["level"],
            parent_id=node_dict.get("parent_id"),
            papers=papers_response,
            paper_count=node_dict.get("paper_count", len(papers_response))
        )
        nodes.append(node_response)
    
    edges = [ClusterEdgeResponse(from_node=edge["from"], to_node=edge["to"]) for edge in cluster_data["edges"]]
    
    return ClusterResponse(nodes=nodes, edges=edges)

# API Endpoints
@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Research Hub API is running", "timestamp": datetime.now().isoformat()}

@app.get("/api/tree")
async def get_tree(
    topic: str = Query(..., description="Research topic to search for"),
    count: int = Query(default=50, ge=1, le=200, description="Number of papers to fetch")
):
    """
    Generate clustered graph data for a research topic
    
    - **topic**: Research topic or query to search for
    - **count**: Number of papers to fetch (max 200)
    
    Returns a hierarchical tree structure with:
    - Unique node IDs
    - Parent-child relationships via edges
    - Papers grouped under clusters
    """
    try:
        logger.info(f"Processing tree request for topic: '{topic}', count: {count}")
        
        # Generate clustered graph data using utility function
        cluster_data = await generate_clustered_graph_data(topic, count)
        
        if not cluster_data or not cluster_data.get("nodes"):
            raise HTTPException(status_code=404, detail=f"No papers found for topic: '{topic}'")
        
        # Convert to API response format
        response = convert_cluster_data_to_response(cluster_data)
        
        logger.info(f"Successfully generated tree with {len(response.nodes)} nodes and {len(response.edges)} edges")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_tree: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/search-and-cluster", response_model=ClusterResponse)
async def search_and_cluster(request: SearchRequest):
    """Legacy endpoint for backward compatibility"""
    try:
        logger.info(f"Processing legacy search request: {request.query}")
        
        # Fetch papers from OpenAlex
        papers = await fetch_papers_from_openalex(
            query=request.query,
            count=request.limit,
            year_from=request.year_from or 2015,
            year_to=request.year_to or 2024
        )
        
        if not papers:
            raise HTTPException(status_code=404, detail="No papers found for the given query")
        
        # Classify papers using Groq AI
        cluster_data = await classify_papers_with_groq(papers)
        
        # Convert to API response format
        return convert_cluster_data_to_response(cluster_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in search_and_cluster: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/papers/search")
async def search_papers(
    query: str = Query(..., description="Search query for papers"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of papers to fetch"),
    year_from: int = Query(default=2015, ge=1900, description="Start year filter"),
    year_to: int = Query(default=2024, le=2030, description="End year filter")
):
    """Search papers from OpenAlex without clustering"""
    try:
        papers = await fetch_papers_from_openalex(query, limit, year_from, year_to)
        papers_response = [convert_paper_to_response(paper) for paper in papers]
        return {"papers": papers_response, "count": len(papers_response)}
    except Exception as e:
        logger.error(f"Error in search_papers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check with system information"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "groq_configured": bool(GROQ_API_KEY),
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
