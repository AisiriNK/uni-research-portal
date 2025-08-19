"""
Research Hub Backend Utilities
Contains functions for fetching papers from OpenAlex and generating clustered graph data
"""

import httpx
import json
import asyncio
import os
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
import uuid

# Configure logging
logger = logging.getLogger(__name__)

# Configuration
OPENALEX_BASE_URL = "https://api.openalex.org"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Data models for internal use
class Author:
    def __init__(self, id: str, name: str, affiliation: Optional[str] = None):
        self.id = id
        self.name = name
        self.affiliation = affiliation

class Concept:
    def __init__(self, id: str, name: str, level: int, score: float):
        self.id = id
        self.name = name
        self.level = level
        self.score = score

class Paper:
    def __init__(self, id: str, title: str, abstract: Optional[str] = None, 
                 authors: List[Author] = None, year: int = 0, doi: Optional[str] = None,
                 url: Optional[str] = None, citation_count: int = 0, 
                 concepts: List[Concept] = None, venue: Optional[str] = None):
        self.id = id
        self.title = title
        self.abstract = abstract
        self.authors = authors or []
        self.year = year
        self.doi = doi
        self.url = url
        self.citation_count = citation_count
        self.concepts = concepts or []
        self.venue = venue

class ClusterNode:
    def __init__(self, id: str, label: str, level: int, parent_id: Optional[str] = None,
                 papers: List[Paper] = None, paper_count: int = 0):
        self.id = id
        self.label = label
        self.level = level
        self.parent_id = parent_id
        self.papers = papers or []
        self.paper_count = paper_count

class ClusterEdge:
    def __init__(self, from_node: str, to_node: str):
        self.from_node = from_node
        self.to_node = to_node

def reconstruct_abstract_from_inverted_index(inverted_abstract: Dict) -> str:
    """Reconstruct abstract text from OpenAlex inverted index"""
    if not inverted_abstract:
        return ""
    
    try:
        # Get all position numbers to determine the length of the abstract
        all_positions = []
        for positions in inverted_abstract.values():
            all_positions.extend(positions)
        
        if not all_positions:
            return ""
        
        max_position = max(all_positions)
        words = [""] * (max_position + 1)
        
        # Place words at their correct positions
        for word, positions in inverted_abstract.items():
            for pos in positions:
                words[pos] = word
        
        # Join words and remove empty strings
        return " ".join(word for word in words if word)
    except Exception as e:
        logger.warning(f"Error reconstructing abstract: {e}")
        return ""

def parse_openalex_paper(paper_data: Dict) -> Optional[Paper]:
    """Parse a single paper from OpenAlex API response"""
    try:
        # Extract basic information
        paper_id = paper_data.get("id", "").replace("https://openalex.org/", "")
        title = paper_data.get("display_name", "")
        year = paper_data.get("publication_year", 0)
        citation_count = paper_data.get("cited_by_count", 0)
        doi = paper_data.get("doi")
        
        # Get URL from primary location
        url = None
        primary_location = paper_data.get("primary_location")
        if primary_location:
            url = primary_location.get("landing_page_url") or primary_location.get("pdf_url")
        
        # Reconstruct abstract
        abstract = ""
        abstract_inverted = paper_data.get("abstract_inverted_index")
        if abstract_inverted:
            abstract = reconstruct_abstract_from_inverted_index(abstract_inverted)
        
        # Parse authors
        authors = []
        authorships = paper_data.get("authorships", [])
        for authorship in authorships:
            author_data = authorship.get("author", {})
            if author_data:
                author_id = author_data.get("id", "").replace("https://openalex.org/", "")
                author_name = author_data.get("display_name", "")
                
                # Get affiliation
                affiliation = None
                institutions = authorship.get("institutions", [])
                if institutions:
                    affiliation = institutions[0].get("display_name", "")
                
                authors.append(Author(id=author_id, name=author_name, affiliation=affiliation))
        
        # Parse concepts
        concepts = []
        concepts_data = paper_data.get("concepts", [])
        for concept_data in concepts_data:
            concept_id = concept_data.get("id", "").replace("https://openalex.org/", "")
            concept_name = concept_data.get("display_name", "")
            level = concept_data.get("level", 0)
            score = concept_data.get("score", 0.0)
            
            concepts.append(Concept(id=concept_id, name=concept_name, level=level, score=score))
        
        # Get venue information
        venue = None
        primary_location = paper_data.get("primary_location")
        if primary_location and primary_location.get("source"):
            venue = primary_location["source"].get("display_name")
        
        return Paper(
            id=paper_id,
            title=title,
            abstract=abstract,
            authors=authors,
            year=year,
            doi=doi,
            url=url,
            citation_count=citation_count,
            concepts=concepts,
            venue=venue
        )
    
    except Exception as e:
        logger.error(f"Error parsing paper: {e}")
        return None

async def fetch_papers_from_openalex(query: str, count: int = 50, year_from: int = 2015, year_to: int = 2024) -> List[Paper]:
    """Fetch papers from OpenAlex API"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{OPENALEX_BASE_URL}/works"
            params = {
                "search": query,
                "per-page": min(count, 200),
                "sort": "cited_by_count:desc",
                "filter": f"type:article,publication_year:{year_from}-{year_to}",
                "select": "id,title,abstract_inverted_index,authorships,publication_year,doi,primary_location,cited_by_count,concepts"
            }
            
            logger.info(f"Fetching {count} papers for query: '{query}'")
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            results = data.get("results", [])
            
            papers = []
            for paper_data in results:
                paper = parse_openalex_paper(paper_data)
                if paper:
                    papers.append(paper)
            
            logger.info(f"Successfully parsed {len(papers)} papers")
            return papers
            
    except Exception as e:
        logger.error(f"Error fetching papers from OpenAlex: {e}")
        raise

async def classify_papers_with_groq(papers: List[Paper]) -> Dict[str, Any]:
    """Use Groq AI to classify papers into hierarchical clusters"""
    if not GROQ_API_KEY:
        logger.warning("Groq API key not configured, using fallback classification")
        return create_fallback_classification(papers)
    
    try:
        # Prepare paper summaries for classification
        paper_summaries = []
        for paper in papers:
            summary = {
                "id": paper.id,
                "title": paper.title,
                "abstract": paper.abstract[:500] if paper.abstract else "",  # Limit abstract length
                "concepts": [concept.name for concept in paper.concepts[:5]]  # Top 5 concepts
            }
            paper_summaries.append(summary)
        
        # Create prompt for Groq AI
        prompt = create_classification_prompt(paper_summaries)
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama3-8b-8192",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert research classifier. Classify academic papers into engineering disciplines and create hierarchical clusters. Always respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 2000
            }
            
            response = await client.post(GROQ_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            
            groq_response = response.json()
            classification_text = groq_response["choices"][0]["message"]["content"]
            
            # Parse JSON response
            try:
                classification_data = json.loads(classification_text)
                return build_cluster_structure(classification_data, papers)
            except json.JSONDecodeError:
                logger.warning("Failed to parse Groq response as JSON, using fallback")
                return create_fallback_classification(papers)
                
    except Exception as e:
        logger.error(f"Error in Groq classification: {e}")
        return create_fallback_classification(papers)

def create_classification_prompt(paper_summaries: List[Dict]) -> str:
    """Create a structured prompt for Groq AI classification"""
    prompt = f"""
Classify these {len(paper_summaries)} research papers into engineering disciplines. 

Create a hierarchical structure with:
1. Main branches: CSE, ECE, EEE, Mechanical, Civil
2. Subclusters within each branch based on specific research areas

For each paper, determine:
- Which main branch it belongs to
- Which subcluster within that branch
- If no existing subcluster fits, suggest a new one

Papers to classify:
"""
    
    for i, paper in enumerate(paper_summaries[:20], 1):  # Limit to first 20 papers for prompt
        prompt += f"\n{i}. ID: {paper['id']}\n"
        prompt += f"   Title: {paper['title']}\n"
        prompt += f"   Abstract: {paper['abstract']}\n"
        prompt += f"   Concepts: {', '.join(paper['concepts'])}\n"
    
    prompt += """

Respond with JSON in this exact format:
{
  "classification": {
    "CSE": {
      "Machine Learning": ["paper_id1", "paper_id2"],
      "Software Engineering": ["paper_id3"]
    },
    "ECE": {
      "Signal Processing": ["paper_id4"],
      "Communication Systems": ["paper_id5"]
    },
    "EEE": {
      "Power Systems": ["paper_id6"],
      "Control Systems": ["paper_id7"]
    },
    "Mechanical": {
      "Robotics": ["paper_id8"],
      "Thermodynamics": ["paper_id9"]
    },
    "Civil": {
      "Structural Engineering": ["paper_id10"],
      "Transportation": ["paper_id11"]
    }
  }
}
"""
    return prompt

def create_fallback_classification(papers: List[Paper]) -> Dict[str, Any]:
    """Create a fallback classification based on keywords when Groq AI is not available"""
    logger.info("Using fallback keyword-based classification")
    
    # Keyword mappings for different branches
    branch_keywords = {
        "CSE": ["software", "algorithm", "computer", "programming", "machine learning", "artificial intelligence", "data", "neural", "deep learning"],
        "ECE": ["electronics", "circuit", "signal", "communication", "wireless", "antenna", "radio", "frequency", "semiconductor"],
        "EEE": ["electrical", "power", "energy", "motor", "generator", "control", "automation", "grid", "voltage", "current"],
        "Mechanical": ["mechanical", "thermal", "fluid", "robotics", "manufacturing", "material", "dynamics", "heat", "engine"],
        "Civil": ["civil", "structural", "construction", "concrete", "building", "bridge", "transportation", "geotechnical", "environmental"]
    }
    
    classification = {branch: {} for branch in branch_keywords.keys()}
    
    for paper in papers:
        # Combine title, abstract, and concepts for keyword matching
        text_content = f"{paper.title} {paper.abstract or ''} {' '.join([concept.name for concept in paper.concepts])}"
        text_content = text_content.lower()
        
        # Find best matching branch
        best_branch = "CSE"  # Default
        max_matches = 0
        
        for branch, keywords in branch_keywords.items():
            matches = sum(1 for keyword in keywords if keyword in text_content)
            if matches > max_matches:
                max_matches = matches
                best_branch = branch
        
        # Create or assign to subcluster
        subcluster = "General"
        if paper.concepts:
            # Use the most relevant concept as subcluster name
            subcluster = paper.concepts[0].name
        
        if subcluster not in classification[best_branch]:
            classification[best_branch][subcluster] = []
        
        classification[best_branch][subcluster].append(paper.id)
    
    return build_cluster_structure({"classification": classification}, papers)

def build_cluster_structure(classification_data: Dict, papers: List[Paper]) -> Dict[str, Any]:
    """Build cluster structure from classification data with unique IDs and proper edges"""
    papers_dict = {paper.id: paper for paper in papers}
    
    nodes = []
    edges = []
    
    # Generate unique IDs for all nodes
    root_id = str(uuid.uuid4())
    
    # Create root node
    root_node = ClusterNode(
        id=root_id,
        label="Research Papers",
        level=0,
        parent_id=None,
        paper_count=len(papers)
    )
    nodes.append(root_node)
    
    branch_nodes = {}
    subcluster_nodes = {}
    
    classification = classification_data.get("classification", {})
    
    # Create branch nodes (level 1)
    for branch_name, subclusters in classification.items():
        if not subclusters:  # Skip empty branches
            continue
            
        branch_id = str(uuid.uuid4())
        branch_papers = []
        
        # Collect all papers in this branch
        for subcluster_papers in subclusters.values():
            for paper_id in subcluster_papers:
                if paper_id in papers_dict:
                    branch_papers.append(papers_dict[paper_id])
        
        branch_node = ClusterNode(
            id=branch_id,
            label=branch_name,
            level=1,
            parent_id=root_id,
            papers=branch_papers,
            paper_count=len(branch_papers)
        )
        nodes.append(branch_node)
        branch_nodes[branch_name] = branch_node
        
        # Create edge from root to branch
        edges.append(ClusterEdge(from_node=root_id, to_node=branch_id))
        
        # Create subcluster nodes (level 2)
        for subcluster_name, paper_ids in subclusters.items():
            if not paper_ids:  # Skip empty subclusters
                continue
                
            subcluster_id = str(uuid.uuid4())
            subcluster_papers = []
            
            for paper_id in paper_ids:
                if paper_id in papers_dict:
                    subcluster_papers.append(papers_dict[paper_id])
            
            if subcluster_papers:  # Only create node if it has papers
                subcluster_node = ClusterNode(
                    id=subcluster_id,
                    label=subcluster_name,
                    level=2,
                    parent_id=branch_id,
                    papers=subcluster_papers,
                    paper_count=len(subcluster_papers)
                )
                nodes.append(subcluster_node)
                subcluster_nodes[f"{branch_name}:{subcluster_name}"] = subcluster_node
                
                # Create edge from branch to subcluster
                edges.append(ClusterEdge(from_node=branch_id, to_node=subcluster_id))
    
    return {
        "nodes": [node.__dict__ for node in nodes],
        "edges": [{"from": edge.from_node, "to": edge.to_node} for edge in edges]
    }

async def generate_clustered_graph_data(topic: str, count: int = 50) -> Dict[str, Any]:
    """
    Main function to generate clustered graph data
    
    Args:
        topic: Search query for papers
        count: Number of papers to fetch
        
    Returns:
        Dict containing nodes and edges for the clustered graph
    """
    try:
        # Step 1: Fetch papers from OpenAlex
        logger.info(f"Fetching papers for topic: '{topic}', count: {count}")
        papers = await fetch_papers_from_openalex(topic, count)
        
        if not papers:
            logger.warning(f"No papers found for topic: '{topic}'")
            return {"nodes": [], "edges": []}
        
        # Step 2: Classify papers and build cluster structure
        logger.info(f"Classifying {len(papers)} papers using Groq AI")
        cluster_data = await classify_papers_with_groq(papers)
        
        logger.info(f"Generated cluster structure with {len(cluster_data['nodes'])} nodes and {len(cluster_data['edges'])} edges")
        
        return cluster_data
        
    except Exception as e:
        logger.error(f"Error generating clustered graph data: {e}")
        raise
