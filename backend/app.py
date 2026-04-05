"""
Research Hub Backend - FastAPI Application
Integrates OpenAlex API for paper fetching and Groq AI for intelligent clustering
"""

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import json
import os
from datetime import datetime, timedelta
import logging
import tempfile
import zipfile
import io
from pathlib import Path
import re
import subprocess
import sys
import base64
from docx import Document
from dotenv import load_dotenv
import os
from pathlib import Path

# Load environment variables from root .env file
root_dir = Path(__file__).parent.parent
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)

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
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_VALIDATION_MODEL = os.getenv("GROQ_VALIDATION_MODEL", "llama-3.3-70b-versatile").strip() or "llama-3.3-70b-versatile"

def extract_docx_text_and_stats(content: bytes) -> Dict[str, Any]:
    doc = Document(io.BytesIO(content))
    paragraphs = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
    text = "\n\n".join(paragraphs)
    image_count = len(doc.inline_shapes)

    figure_captions: List[str] = []
    table_captions: List[str] = []
    for para in paragraphs:
        # Match "Figure N: ..." or "Fig N: ..." or "caption: ..." and extract only the caption text
        fig_match = re.match(r"^(?:Figure|Fig\.?|caption)\s*[\d.]*\s*[:.-]?\s*(.*)$", para, re.IGNORECASE)
        if fig_match:
            caption_text = fig_match.group(1).strip()
            if caption_text:  # Only add if caption text exists
                figure_captions.append(caption_text)
            continue
        table_match = re.match(r"^Table\s*([\d.]+)\s*[:.-]?\s*(.*)$", para, re.IGNORECASE)
        if table_match:
            table_captions.append(para)

    return {
        "text": text,
        "paragraphs": paragraphs,
        "image_count": image_count,
        "figure_captions": figure_captions,
        "table_captions": table_captions,
    }

def build_local_validation_issues(stats: Dict[str, Any]) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    image_count = stats.get("image_count", 0)
    figure_captions = stats.get("figure_captions", [])
    table_captions = stats.get("table_captions", [])
    paragraphs = stats.get("paragraphs", [])

    if image_count > len(figure_captions):
        issues.append({
            "severity": "critical",
            "label": "Missing figure captions",
            "message": f"Found {image_count} images but only {len(figure_captions)} figure captions.",
            "suggestion": "Add a caption line for every figure (e.g., Fig 4.1: ...)."
        })

    def has_reference(caption_line: str) -> bool:
        ref = None
        match = re.match(r"^(Figure|Fig\.?)[\s]*([\d.]+)", caption_line, re.IGNORECASE)
        if match:
            ref = match.group(0)
        if not ref:
            return False
        for para in paragraphs:
            if para.strip() == caption_line.strip():
                continue
            if ref in para:
                return True
        return False

    for caption in figure_captions:
        if not has_reference(caption):
            issues.append({
                "severity": "warning",
                "label": "Figure not referenced",
                "message": f"No explanation paragraph referencing '{caption}'.",
                "suggestion": "Add a sentence in the text referring to this figure."
            })

    for caption in table_captions:
        match = re.match(r"^Table\s*([\d.]+)", caption, re.IGNORECASE)
        ref = match.group(0) if match else caption
        referenced = False
        for para in paragraphs:
            if para.strip() == caption.strip():
                continue
            if ref in para:
                referenced = True
                break
        if not referenced:
            issues.append({
                "severity": "warning",
                "label": "Table not referenced",
                "message": f"No explanation paragraph referencing '{caption}'.",
                "suggestion": "Add a sentence in the text referring to this table."
            })

    if not table_captions:
        issues.append({
            "severity": "warning",
            "label": "Missing table captions",
            "message": "No table captions were detected.",
            "suggestion": "Add captions for tables using 'Table X: ...' format."
        })

    return issues

async def run_groq_validation(text: str, stats: Dict[str, Any]) -> List[Dict[str, str]]:
    if not GROQ_API_KEY:
        return [{
            "severity": "warning",
            "label": "Validator unavailable",
            "message": "Groq API key not configured. Local checks only.",
            "suggestion": "Set GROQ_API_KEY in the .env file."
        }]

    prompt = f"""You are a report quality validator. Analyze the report text and return JSON with SPECIFIC LOCATIONS.

CRITICAL: For EVERY issue found, include:
1. "location": The exact text snippet where the error occurs (10-20 words of context)
2. "example": The incorrect text shown as-is from the report
3. "correction": What it should be changed to

Rules for each type of error:

CAPITALIZATION ISSUES:
- Chapter headings must be "CHAPTER - I", "CHAPTER - II", etc (with space after dash)
- Major section titles should be in ALL CAPS
- Normal sentences should use normal capitalization (not all caps randomly)
- For each issue: show the exact text as it appears, what's wrong, and how to fix it
Example: {{"severity":"warning","label":"Capitalization","message":"Found: 'software Requirements' should be 'Software Requirements'","location":"The software Requirements define the necessary tools","example":"software Requirements","correction":"Software Requirements"}}

SPELLING ERRORS:
- Look for misspelled words
- For each: show the misspelled word and correct spelling
Example: {{"severity":"warning","label":"Spelling","message":"Word 'recomendation' is misspelled","location":"The recomendation system uses AI","example":"recomendation","correction":"recommendation"}}

GRAMMAR & PUNCTUATION:
- Check for sentence structure, subject-verb agreement, missing punctuation
- For each: show the problematic sentence excerpt
Example: {{"severity":"warning","label":"Grammar","message":"Subject-verb disagreement: 'The data are' should be 'The data is'","location":"The data are stored in Firebase","example":"The data are stored","correction":"The data is stored"}}

FIGURE/TABLE REFERENCES:
- Every figure caption must have text referring to it (e.g., "Figure 1 shows...", "As seen in Figure 2")
- Every table caption must have text referring to it (e.g., "Table 1 lists...", "As shown in Table 3")
- If a figure/table is not referenced in the text, mark as critical
Example: {{"severity":"critical","label":"Missing Reference","message":"Table 5.1 'Test cases' has no explanation paragraph referencing it","location":"[Show where table appears]","example":"Table 5.1 Test cases","correction":"Add reference: 'Table 5.1 shows the test cases used in...'"}}

Context:
Image count: {stats.get('image_count', 0)}
Figure captions found: {len(stats.get('figure_captions', []))}
Table captions found: {len(stats.get('table_captions', []))}

Return ONLY valid JSON:
{{
  "issues": [
    {{"severity":"warning|critical","label":"Issue Type","message":"Description","location":"context text","example":"wrong text","correction":"corrected text"}}
  ]
}}

Report text:
"""
    prompt = prompt + text[:16000]

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_VALIDATION_MODEL,
            messages=[
                {"role": "system", "content": "Return JSON only. Do not include markdown or explanations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
        )
        raw = response.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("Groq validation failed: %s", exc)
        return [{
            "severity": "warning",
            "label": "Validator unavailable",
            "message": "Groq validation failed. Local checks only.",
            "suggestion": "Ensure Groq API is reachable and GROQ_API_KEY is valid."
        }]

    try:
        parsed = json.loads(raw)
        issues = parsed.get("issues", []) if isinstance(parsed, dict) else []
        return [issue for issue in issues if isinstance(issue, dict)]
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            try:
                parsed = json.loads(json_match.group(0))
                issues = parsed.get("issues", []) if isinstance(parsed, dict) else []
                return [issue for issue in issues if isinstance(issue, dict)]
            except json.JSONDecodeError:
                pass
        return [{
            "severity": "warning",
            "label": "Validator output",
            "message": "Groq returned non-JSON output. Review manually.",
            "suggestion": "Ensure the Groq model returns valid JSON only."
        }]

# Pydantic models for API responses
class AuthorResponse(BaseModel):
    id: str

# Document processing models
class TeamMember(BaseModel):
    name: str
    usn: str

class ProjectDetails(BaseModel):
    title: str
    guide: str
    guide_designation: str = ""
    guide_department: str = ""
    subject_code: str = ""
    subject_name: str = ""
    hod_name: str = ""
    hod_designation: str = ""
    hod_department: str = ""
    principal_name: str = ""
    principal_designation_1: str = ""
    principal_designation_2: str = ""
    semester: str = ""
    abstract_content: str = ""
    year: str
    team_members: List[TeamMember]

class ProcessDocumentRequest(BaseModel):
    project_details: ProjectDetails

class ChapterData(BaseModel):
    title: str
    content: str
    images: List[Dict[str, str]] = []

class ProcessDocumentResponse(BaseModel):
    chapters: List[ChapterData]
    main_tex: str
    chapter_files: Dict[str, str]
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


class ClientLogEntry(BaseModel):
    source: str = Field(default="client")
    event: str
    level: str = Field(default="info")
    details: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

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


@app.post("/api/logs")
async def ingest_client_log(entry: ClientLogEntry):
    """Receive client-side logs and surface them in the server terminal."""
    level = entry.level.lower()
    level = "warning" if level == "warn" else level
    log_fn = getattr(logger, level, logger.info)
    details_text = ""
    if entry.details:
        try:
            details_text = json.dumps(entry.details, default=str)
        except TypeError:
            details_text = str(entry.details)

    message = f"[CLIENT LOG][{entry.source}] {entry.event}"
    if details_text:
        message += f" | details={details_text}"
    if entry.timestamp:
        message += f" | client_ts={entry.timestamp.isoformat()}"

    log_fn(message)
    return {"status": "logged"}

# Document processing utility functions
def load_latex_template():
    """Load the LaTeX template file"""
    template_path = Path(__file__).parent / "templates" / "report_template.tex"
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="LaTeX template not found")

def process_document_content_with_groq(content: str) -> List[ChapterData]:
    """Process document content using Groq AI to extract chapters"""
    try:
        from groq import Groq
        
        if not GROQ_API_KEY:
            logger.error("Groq API key not configured")
            raise HTTPException(status_code=500, detail="Groq API key not configured. Please set GROQ_API_KEY in your .env file.")
        
        client = Groq(api_key=GROQ_API_KEY)
        
        # Enhanced prompt for LaTeX document processing
        structure_prompt = f"""
You are given a document content that you must process for LaTeX template generation. 
The LaTeX template defines the formatting for a report with chapters, headers, footers, 
and styles. Your task is to automatically generate structured chapter data 
for use with this template.

DOCUMENT CONTENT:
{content[:8000]}... (content may be truncated for analysis, but full content will be processed)

INSTRUCTIONS:

1. Template Usage:
   - Use the provided LaTeX template exactly as the formatting base
   - Keep all style settings unchanged
   - Replace placeholders like {{ chapter_number }}, {{ chapter_title }}, and {{ chapter_content }} with extracted contents

2. Chapter Handling:
   - Detect chapters based on "Chapter X" or "CHAPTER X:" patterns
   - Assign sequential numbers (1, 2, 3 …)
   - Continue page numbers across chapters without resetting

3. Content Replacement:
   - Replace {{ chapter_title }} with the chapter's title
   - Replace {{ chapter_content }} with LaTeX-compatible text
   - Ensure each chapter has proper paragraph breaks (\\n\\n)

4. Figures and Images:
   - Detect any image references (figures, diagrams, charts, screenshots)
   - Each image must be represented with metadata:
       {
         "filename": "image_filename.png",
         "caption": "Descriptive caption without numbering",
         "image_number": 1
       }
   - Do NOT add "Fig. X.Y" inside the caption text. 
   - Only supply a plain descriptive caption. The LaTeX template will automatically prepend "Fig. X.Y".

5. Content Analysis:
   - If no explicit chapters exist, divide logically into Introduction, Literature Review, Methodology, Results, Discussion, Conclusion
   - Ensure each chapter is substantial (min 100 words if possible)

REQUIRED OUTPUT FORMAT:
Return ONLY valid JSON array of chapter objects:

[
  {
    "title": "Introduction",
    "content": "LaTeX-ready text with escaped characters and paragraph breaks (\\n\\n)",
    "images": [
      {
        "filename": "intro_diagram.png",
        "caption": "System Architecture Diagram",
        "image_number": 1
      }
    ]
  },
  {
    "title": "Methodology",
    "content": "Second chapter content...",
    "images": [
      {
        "filename": "workflow.png",
        "caption": "Workflow of Proposed Method",
        "image_number": 1
      },
      {
        "filename": "pipeline.png",
        "caption": "Data Processing Pipeline",
        "image_number": 2
      }
    ]
  }
]

CRITICAL REQUIREMENTS:
- Extract ALL chapters
- Maintain academic structure and flow
- Figures must be numbered in order per chapter (X.Y) by the LaTeX template, not in JSON
- JSON must include image_number for ordering
- Provide captions as plain descriptive text
- Return ONLY valid JSON, no explanations or extra text

"""

        structure_response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an expert LaTeX document processor and structure analyzer. You specialize in converting academic documents into properly formatted LaTeX reports with multiple chapters. Return only valid JSON that matches the specified format exactly."},
                {"role": "user", "content": structure_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            max_tokens=4000,
            timeout=30  # 30 second timeout
        )
        
        # Parse the response
        import re
        response_text = structure_response.choices[0].message.content
        logger.info(f"Groq response received: {response_text[:200]}...")
        
        # Try to extract JSON from the response
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        
        if json_match:
            try:
                chapters_data = json.loads(json_match.group())
                logger.info(f"Successfully parsed {len(chapters_data)} chapters from document")
                
                # Validate and create ChapterData objects
                validated_chapters = []
                for i, chapter in enumerate(chapters_data):
                    try:
                        # Ensure required fields exist
                        if not isinstance(chapter, dict):
                            continue
                        
                        title = chapter.get('title', f'Chapter {i+1}')
                        content = chapter.get('content', '')
                        images = chapter.get('images', [])
                        
                        # Validate images structure
                        if not isinstance(images, list):
                            images = []
                        
                        validated_chapters.append(ChapterData(
                            title=title,
                            content=content,
                            images=images
                        ))
                    except Exception as e:
                        logger.warning(f"Error validating chapter {i}: {e}")
                        continue
                
                if validated_chapters:
                    return validated_chapters
                else:
                    logger.warning("No valid chapters found in AI response")
                    
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing error: {e}")
                logger.error(f"Raw response: {response_text}")
        else:
            logger.warning("No JSON array found in AI response")
            
        # Fallback: create logical chapters from content
        logger.info("Using fallback chapter creation")
        return create_fallback_chapters(content)
            
    except Exception as e:
        logger.error(f"Error processing document with Groq: {e}")
        # Fallback: create a single chapter
        return [ChapterData(title="Document Content", content=content, images=[])]

def create_fallback_chapters(content: str) -> List[ChapterData]:
    """Create fallback chapters when AI processing fails"""
    # Split content into paragraphs
    paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
    
    if len(paragraphs) <= 3:
        # Too short, create single chapter
        return [ChapterData(title="Document Content", content=content, images=[])]
    
    # Try to create logical chapters
    chapters = []
    words_total = len(content.split())
    
    if words_total > 1000:
        # Create multiple chapters for longer documents
        chunk_size = len(paragraphs) // 3
        
        # Introduction
        intro_paras = paragraphs[:chunk_size]
        chapters.append(ChapterData(
            title="Introduction",
            content='\n\n'.join(intro_paras),
            images=[]
        ))
        
        # Main Content
        main_paras = paragraphs[chunk_size:chunk_size*2]
        chapters.append(ChapterData(
            title="Main Content",
            content='\n\n'.join(main_paras),
            images=[]
        ))
        
        # Conclusion
        conclusion_paras = paragraphs[chunk_size*2:]
        chapters.append(ChapterData(
            title="Conclusion",
            content='\n\n'.join(conclusion_paras),
            images=[]
        ))
    else:
        # Single chapter for shorter documents
        chapters.append(ChapterData(
            title="Document Content",
            content=content,
            images=[]
        ))
    
    return chapters

def run_report_pipeline(doc_path: str, project_details: ProjectDetails, dept: str = "") -> Dict[str, Any]:
    """Run the AI report formatting pipeline script using the uploaded document path and UI metadata."""
    script_path = Path(__file__).parent / "ai_report_pipeline.py"
    if not script_path.exists():
        logger.error("Pipeline script not found at %s", script_path)
        raise HTTPException(status_code=500, detail="Pipeline script not found")

    team_members_payload = [member.model_dump() for member in project_details.team_members]
    command = [
        sys.executable,
        str(script_path),
        "--input",
        doc_path,
        "--project-title",
        project_details.title,
        "--subject-name",
        project_details.subject_name,
        "--subject-code",
        project_details.subject_code,
        "--guide-name",
        project_details.guide,
        "--guide-designation",
        project_details.guide_designation,
        "--guide-department",
        project_details.guide_department,
        "--hod-name",
        project_details.hod_name,
        "--hod-designation",
        project_details.hod_designation,
        "--hod-department",
        project_details.hod_department,
        "--principal-name",
        project_details.principal_name,
        "--principal-designation-1",
        project_details.principal_designation_1,
        "--principal-designation-2",
        project_details.principal_designation_2,
        "--semester",
        project_details.semester,
        "--abstract-content",
        project_details.abstract_content,
        "--year",
        project_details.year,
        "--dept",
        dept or "",
        "--team-members-json",
        json.dumps(team_members_payload)
    ]

    logger.info("Running report pipeline script: %s", " ".join(command))

    # Get timeout from environment or default to 600 seconds (10 minutes)
    pipeline_timeout = int(os.getenv("PIPELINE_TIMEOUT_SECONDS", "600"))
    logger.info("Pipeline timeout set to: %d seconds", pipeline_timeout)

    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=pipeline_timeout)
    except subprocess.TimeoutExpired:
        logger.error("Pipeline script timed out after %d seconds", pipeline_timeout)
        raise HTTPException(status_code=500, detail=f"Pipeline script timed out after {pipeline_timeout} seconds")

    if result.returncode != 0:
        logger.error("Pipeline script failed: %s", result.stderr)
        raise HTTPException(status_code=500, detail="Pipeline script failed")

    if result.stdout:
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return {"raw_output": result.stdout.strip()}

    return {"status": "ok"}


def generate_latex_files(project_details: ProjectDetails, chapters: List[ChapterData]) -> Dict[str, str]:
    """Generate LaTeX files from template and chapter data"""
    
    # Load template
    template = load_latex_template()
    
    # Replace project title placeholder
    main_tex = template.replace("{{ project_title }}", project_details.title)
    
    # Find the chapter template section in the template
    chapter_template_start = main_tex.find("% ----------- Chapter Template (Repeat for each chapter) -----------")
    chapter_template_end = main_tex.find("% ---------------------------------------------------------------")
    
    if chapter_template_start == -1 or chapter_template_end == -1:
        raise HTTPException(status_code=500, detail="Chapter template section not found in template")
    
    # Extract the chapter template
    chapter_template = main_tex[chapter_template_start:chapter_template_end + len("% ---------------------------------------------------------------")]
    
    # Generate all chapters using the template
    all_chapters_content = ""
    
    for i, chapter in enumerate(chapters):
        chapter_number = i + 1
        
        # Create chapter content with images integrated
        chapter_content_with_images = chapter.content
        
        # Add images at appropriate positions
        for img_index, image in enumerate(chapter.images):
            if image.get('filename') and image.get('caption'):
                image_latex = f"""

\\begin{{figure}}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{{images/{image['filename']}}}
    \\caption{{{image['caption']}}}
    \\label{{fig:chapter{chapter_number}_image{img_index + 1}}}
\\end{{figure}}

"""
                # Insert image at the end of content or at specified position
                if 'position' in image and 'after_paragraph' in image['position']:
                    # Try to insert after specific paragraph (basic implementation)
                    paragraphs = chapter_content_with_images.split('\n\n')
                    try:
                        para_num = int(image['position'].split('_')[-1]) - 1
                        if 0 <= para_num < len(paragraphs):
                            paragraphs.insert(para_num + 1, image_latex.strip())
                            chapter_content_with_images = '\n\n'.join(paragraphs)
                        else:
                            chapter_content_with_images += image_latex
                    except (ValueError, IndexError):
                        chapter_content_with_images += image_latex
                else:
                    chapter_content_with_images += image_latex
        
        # Replace placeholders in chapter template
        chapter_latex = chapter_template.replace("{{ chapter_number }}", str(chapter_number))
        chapter_latex = chapter_latex.replace("{{ chapter_title | upper }}", chapter.title.upper())
        chapter_latex = chapter_latex.replace("{{ chapter_title }}", chapter.title)
        chapter_latex = chapter_latex.replace("{{ chapter_content | safe }}", chapter_content_with_images)
        
        # Add to combined content
        all_chapters_content += chapter_latex + "\n\n"
    
    # Replace the template section with all generated chapters
    final_tex = main_tex[:chapter_template_start] + all_chapters_content + main_tex[chapter_template_end + len("% ---------------------------------------------------------------"):]
    
    # Clean up any remaining template markers
    final_tex = final_tex.replace("\\end{document}", "").strip() + "\n\n\\end{document}\n"
    
    return {
        "report.tex": final_tex
    }

# API Routes for document processing
@app.post("/api/process-document")
async def process_document(
    file: UploadFile = File(...),
    project_title: str = Form(...),
    subject_code: str = Form(""),
    subject_name: str = Form(""),
    guide_name: str = Form(...),
    guide_designation: str = Form(""),
    guide_department: str = Form(""),
    hod_name: str = Form(""),
    hod_designation: str = Form(""),
    hod_department: str = Form(""),
    principal_name: str = Form(""),
    principal_designation: str = Form(""),
    principal_designation2: str = Form(""),
    semester: str = Form(""),
    abstract_content: str = Form(""),
    year: str = Form(...),
    team_members_json: str = Form(...),
    dept: str = Form("")
):
    """Process uploaded document and generate LaTeX files"""
    temp_file_path = None
    try:
        # Validate file type
        if not file.filename.endswith(('.doc', '.docx', '.txt')):
            raise HTTPException(status_code=400, detail="Only .doc, .docx, and .txt files are supported")
        
        # Parse team members
        try:
            team_members_data = json.loads(team_members_json)
            team_members = [TeamMember(**member) for member in team_members_data]
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid team members data: {e}")
        
        # Create project details
        project_details = ProjectDetails(
            title=project_title,
            guide=guide_name,
            guide_designation=guide_designation,
            guide_department=guide_department,
            subject_code=subject_code,
            subject_name=subject_name,
            hod_name=hod_name,
            hod_designation=hod_designation,
            hod_department=hod_department,
            principal_name=principal_name,
            principal_designation_1=principal_designation,
            principal_designation_2=principal_designation2,
            semester=semester,
            abstract_content=abstract_content,
            year=year,
            team_members=team_members
        )
        
        # Read file content
        content = await file.read()

        # Save file to a temporary path for pipeline execution
        file_suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_suffix) as tmp_file:
            tmp_file.write(content)
            temp_file_path = tmp_file.name

        # Run pipeline script using UI metadata and the uploaded document path
        pipeline_result = run_report_pipeline(temp_file_path, project_details, dept=dept)
        logger.info("Pipeline completed: %s", pipeline_result)

        merged_pdf_base64 = None
        merged_pdf_name = None
        merged_pdf_path = None
        if isinstance(pipeline_result, dict):
            merged_pdf_path = pipeline_result.get("merged_pdf", {}).get("output_path")

        if merged_pdf_path and os.path.exists(merged_pdf_path):
            with open(merged_pdf_path, "rb") as pdf_file:
                merged_pdf_base64 = base64.b64encode(pdf_file.read()).decode("utf-8")
            merged_pdf_name = Path(merged_pdf_path).name

        word_file_base64 = None
        word_file_name = None
        merged_docx_path = None
        if isinstance(pipeline_result, dict):
            merged_docx_path = pipeline_result.get("merged_docx", {}).get("output_path")

        if merged_docx_path and os.path.exists(merged_docx_path):
            with open(merged_docx_path, "rb") as docx_file:
                word_file_base64 = base64.b64encode(docx_file.read()).decode("utf-8")
            word_file_name = Path(merged_docx_path).name
        
        # Process different file types
        if file.filename.endswith('.txt'):
            # For .txt files, decode directly
            document_content = content.decode('utf-8')
        elif file.filename.endswith('.docx'):
            # For .docx files, use python-docx
            try:
                from docx import Document
                import io
                
                # Create a BytesIO object from the content
                doc_file = io.BytesIO(content)
                doc = Document(doc_file)
                
                # Extract text from all paragraphs
                paragraphs = []
                for para in doc.paragraphs:
                    if para.text.strip():
                        paragraphs.append(para.text.strip())
                
                document_content = '\n\n'.join(paragraphs)
                logger.info(f"Extracted {len(paragraphs)} paragraphs from .docx file")
                
            except Exception as e:
                logger.error(f"Error processing .docx file: {e}")
                raise HTTPException(status_code=400, detail=f"Unable to process .docx file: {str(e)}")
        elif file.filename.endswith('.doc'):
            # For .doc files (older format), we'll try to decode as text
            # Note: For proper .doc support, you'd need python-docx2txt or similar
            try:
                document_content = content.decode('utf-8')
            except UnicodeDecodeError:
                # Try different encodings
                for encoding in ['latin-1', 'cp1252', 'iso-8859-1']:
                    try:
                        document_content = content.decode(encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    raise HTTPException(status_code=400, detail="Unable to decode .doc file. Please convert to .docx or .txt format.")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please use .docx, .doc, or .txt files.")
        
        # Process document with Groq AI
        logger.info(f"Processing document content with Groq AI. Content length: {len(document_content)}")
        chapters = process_document_content_with_groq(document_content)
        logger.info(f"Successfully extracted {len(chapters)} chapters")
        
        # Generate LaTeX files
        logger.info("Generating LaTeX files from chapters")
        generated_files = generate_latex_files(project_details, chapters)
        logger.info(f"Successfully generated {len(generated_files)} LaTeX files")
        
        return {
            "success": True,
            "message": f"Successfully processed document with {len(chapters)} chapters",
            "chapters": [{"title": ch.title, "content": ch.content[:200] + "..." if len(ch.content) > 200 else ch.content} for ch in chapters],
            "files": generated_files,
            "file_count": len(generated_files),
            "pipeline": pipeline_result,
            "merged_pdf_base64": merged_pdf_base64,
            "merged_pdf_name": merged_pdf_name,
            "word_file_base64": word_file_base64,
            "word_file_name": word_file_name
        }
        
    except Exception as e:
        logger.error(f"Error processing document: {e}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                logger.warning("Failed to remove temp file: %s", temp_file_path)


@app.post("/api/validate-document")
async def validate_document(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith(('.doc', '.docx', '.txt')):
            raise HTTPException(status_code=400, detail="Only .doc, .docx, and .txt files are supported")

        content = await file.read()

        if file.filename.endswith('.docx'):
            stats = extract_docx_text_and_stats(content)
            document_text = stats.get("text", "")
        elif file.filename.endswith('.txt'):
            document_text = content.decode('utf-8', errors='ignore')
            stats = {
                "text": document_text,
                "paragraphs": [line.strip() for line in document_text.splitlines() if line.strip()],
                "image_count": 0,
                "figure_captions": [],
                "table_captions": [],
            }
        else:
            try:
                document_text = content.decode('utf-8')
            except UnicodeDecodeError:
                document_text = content.decode('latin-1', errors='ignore')
            stats = {
                "text": document_text,
                "paragraphs": [line.strip() for line in document_text.splitlines() if line.strip()],
                "image_count": 0,
                "figure_captions": [],
                "table_captions": [],
            }

        local_issues = build_local_validation_issues(stats)
        groq_issues: List[Dict[str, str]] = []
        if document_text.strip():
            try:
                groq_issues = await run_groq_validation(document_text, stats)
            except Exception as exc:
                logger.error("Groq validation failed: %s", exc)
                groq_issues = [{
                    "severity": "warning",
                    "label": "Validator unavailable",
                    "message": "Groq validation failed. Local checks only.",
                    "suggestion": "Ensure Groq is reachable and GROQ_API_KEY is set."
                }]

        issues = local_issues + groq_issues
        critical = sum(1 for issue in issues if issue.get("severity") == "critical")
        warnings = sum(1 for issue in issues if issue.get("severity") == "warning")

        return JSONResponse(content={
            "success": True,
            "issues": issues,
            "summary": {
                "critical": critical,
                "warnings": warnings,
                "images": stats.get("image_count", 0),
                "figureCaptions": len(stats.get("figure_captions", [])),
                "tableCaptions": len(stats.get("table_captions", [])),
            }
        })
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Validation error: %s", exc)
        raise HTTPException(status_code=500, detail="Validation failed")

@app.post("/api/download-latex-project")
async def download_latex_project(
    file: UploadFile = File(...),
    project_title: str = Form(...),
    guide_name: str = Form(...),
    year: str = Form(...),
    team_members_json: str = Form(...),
    dept: str = Form("")
):
    """Process document and return a ZIP file with all LaTeX files"""
    temp_file_path = None
    try:
        # Process the document (reuse the logic from process_document)
        # Parse team members
        team_members_data = json.loads(team_members_json)
        team_members = [TeamMember(**member) for member in team_members_data]
        
        project_details = ProjectDetails(
            title=project_title,
            guide=guide_name,
            year=year,
            team_members=team_members
        )
        
        # Read and process document
        content = await file.read()
        file_suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_suffix) as tmp_file:
            tmp_file.write(content)
            temp_file_path = tmp_file.name

        pipeline_result = run_report_pipeline(temp_file_path, project_details, dept=dept)
        logger.info("Pipeline completed: %s", pipeline_result)

        if file.filename.endswith('.txt'):
            document_content = content.decode('utf-8')
        else:
            document_content = content.decode('utf-8')
        
        chapters = process_document_content_with_groq(document_content)
        generated_files = generate_latex_files(project_details, chapters)
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename, content in generated_files.items():
                zip_file.writestr(filename, content)
            
            # Add a README
            readme_content = f"""LaTeX Project: {project_title}

Generated files:
{chr(10).join([f"- {filename}" for filename in generated_files.keys()])}

To compile:
1. Ensure you have LaTeX installed (e.g., MiKTeX, TeX Live)
2. Place any images in an 'images/' subdirectory
3. Run: pdflatex report.tex
4. For bibliography: bibtex report && pdflatex report.tex && pdflatex report.tex

Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
            zip_file.writestr("README.txt", readme_content)
        
        zip_buffer.seek(0)
        
        # Return ZIP file
        headers = {
            'Content-Disposition': f'attachment; filename="{project_title.replace(" ", "_")}_latex_project.zip"'
        }
        
        return JSONResponse(
            content={"download_url": "/api/download-generated-zip"},
            headers=headers
        )
        
    except Exception as e:
        logger.error(f"Error creating LaTeX project ZIP: {e}")
        raise HTTPException(status_code=500, detail=f"ZIP creation failed: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                logger.warning("Failed to remove temp file: %s", temp_file_path)

@app.get("/api/health")
async def health_check():
    """Health check with system information"""
    # Check MCP server health
    mcp_healthy = False
    try:
        from mcp_integration import check_mcp_health
        mcp_healthy = await check_mcp_health()
    except Exception as e:
        logger.warning(f"MCP health check failed: {e}")
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "groq_configured": bool(GROQ_API_KEY),
        "mcp_server": "healthy" if mcp_healthy else "unavailable",
        "version": "1.0.0"
    }

# ============================================================================
# MCP Integration Endpoints
# ============================================================================

@app.post("/api/mcp/orchestrate-clustering")
async def mcp_orchestrate_clustering(
    query: str = Query(..., description="Research query"),
    limit: int = Query(default=50, ge=1, le=200),
    num_clusters: int = Query(default=5, ge=2, le=10),
    owner_id: str = Query(default="api_user")
):
    """
    Orchestrate paper clustering using MCP server
    Returns MCP context ID and workflow results
    """
    try:
        from mcp_integration import orchestrate_paper_clustering
        
        result = await orchestrate_paper_clustering(
            query=query,
            limit=limit,
            num_clusters=num_clusters,
            owner_id=owner_id
        )
        
        return {
            "success": True,
            "context_id": result["context_id"],
            "workflow_status": result["workflow_result"]["status"],
            "papers_count": len(result["papers"]),
            "clusters_count": len(result["clusters"]),
            "execution_time_ms": result["execution_time_ms"],
            "papers": result["papers"][:20],  # Return first 20 papers
            "clusters": result["clusters"]
        }
        
    except Exception as e:
        logger.error(f"MCP clustering orchestration failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"MCP orchestration failed: {str(e)}"
        )

@app.api_route("/api/generate-research-gaps", methods=["GET", "POST"])
async def generate_research_gaps_endpoint(
    base_paper_title: str = Query(..., description="Title of the base paper"),
    base_paper_abstract: str = Query(..., description="Abstract of the base paper"),
    related_papers_data: str = Query(..., description="JSON array of related papers"),
    domain: str = Query(default="Computer Science")
):
    """
    Generate research gaps using Groq AI
    """
    try:
        from groq import Groq
        import json
        
        if not GROQ_API_KEY:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
        
        client = Groq(api_key=GROQ_API_KEY)
        
        # Parse related papers
        try:
            related_papers = json.loads(related_papers_data)
        except:
            related_papers = []
        
        # Build context for Groq
        papers_context = "\n\n".join([
            f"Paper {i+1}: {p.get('title', 'Unknown')}\nAbstract: {p.get('abstract', 'No abstract')[:300]}"
            for i, p in enumerate(related_papers[:10])
        ])
        
        prompt = f"""You are a research analyst. Analyze the following base paper and related work to identify research gaps.

Base Paper: {base_paper_title}
Abstract: {base_paper_abstract}

Related Work:
{papers_context}

Identify 3-5 specific research gaps. For each gap, provide:
1. A clear title
2. Detailed description (2-3 sentences)
3. Justification based on the papers
4. Confidence score (0-1)

IMPORTANT: Return ONLY a valid JSON array, nothing else. No markdown blocks, no explanations.
Each object must have: title (string), description (string), justification (string), confidence (number 0-1), category (string)

Example format:
[{{"title": "Gap Title", "description": "Description here", "justification": "Why this is a gap", "confidence": 0.85, "category": "methodology"}}]"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2048
        )
        
        result_text = response.choices[0].message.content
        
        logger.info(f"Groq raw response (first 500 chars): {result_text[:500]}")
        logger.info(f"Groq full response: {result_text}")
        
        # Try to parse JSON from response
        try:
            # Extract JSON if wrapped in markdown code blocks
            if "```json" in result_text:
                logger.info("Detected ```json markdown block, removing...")
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                logger.info("Detected ``` markdown block, removing...")
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            logger.info(f"Cleaned response before parsing: {result_text[:500]}")
            gaps = json.loads(result_text)
            logger.info(f"Successfully parsed {len(gaps)} gaps")
            
            return {
                "success": True,
                "gaps": gaps,
                "model_used": "llama-3.3-70b-versatile"
            }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq response as JSON: {e}")
            logger.error(f"Response text: {result_text}")
            raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
        
    except Exception as e:
        logger.error(f"Research gap generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mcp/orchestrate-gaps")
async def mcp_orchestrate_gap_analysis(
    base_paper: Dict[str, Any],
    related_papers: List[Dict[str, Any]],
    domain: str = Query(default="Computer Science"),
    owner_id: str = Query(default="api_user")
):
    """
    Orchestrate research gap analysis using MCP server
    """
    try:
        from mcp_integration import orchestrate_research_gaps
        
        result = await orchestrate_research_gaps(
            base_paper=base_paper,
            related_papers=related_papers,
            domain=domain,
            owner_id=owner_id
        )
        
        return {
            "success": True,
            "context_id": result["context_id"],
            "workflow_status": result["workflow_result"]["status"],
            "research_gaps": result["research_gaps"],
            "agent_logs": result["agent_logs"][-10:]  # Last 10 logs
        }
        
    except Exception as e:
        logger.error(f"MCP gap analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Gap analysis orchestration failed: {str(e)}"
        )

@app.get("/api/mcp/context/{context_id}")
async def mcp_get_context(context_id: str):
    """
    Get cached MCP context results
    """
    try:
        from mcp_integration import get_cached_context
        
        context = await get_cached_context(context_id)
        
        if not context:
            raise HTTPException(status_code=404, detail="Context not found or expired")
        
        return {
            "success": True,
            "context": context
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get MCP context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HALL TICKET ENDPOINTS
# ============================================================================

@app.post("/api/hall-tickets/{usn}/generate")
async def generate_and_store_hall_ticket(usn: str, admin_id: str = Query(...)):
    """
    Generate hall ticket PDF, store in Firebase Storage, and save metadata to Firestore
    
    Returns:
        - downloadUrl: URL to download the PDF from Firebase Storage
        - semesterNumber: Semester for which ticket was generated
        - generatedAt: Timestamp when ticket was generated
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, storage, firestore
        from datetime import datetime
        import subprocess
        import json
        
        # Initialize Firebase if not already done
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred, {
                'storageBucket': os.getenv('VITE_FIREBASE_STORAGE_BUCKET')
            })
        
        # Generate hall ticket PDF using existing logic (via subprocess or direct call)
        # For now, we'll create a simple PDF endpoint
        logger.info(f"Generating hall ticket for {usn} by admin {admin_id}")
        
        # Call frontend's generateHallTicket function via subprocess
        # This is a workaround - ideally we'd refactor the PDF generation to backend
        import tempfile
        
        pdf_path = f"/tmp/hall_ticket_{usn}_{datetime.now().timestamp()}.pdf"
        
        # Generate PDF (placeholder - in real implementation, refactor from frontend)
        # For now, return error asking to use frontend generation
        raise HTTPException(
            status_code=501,
            detail="Hall ticket PDF generation needs to be called from frontend. Use the downloadHallTicket function, then upload the result to this endpoint."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate hall ticket for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/hall-tickets/{usn}/upload")
async def upload_hall_ticket(
    usn: str,
    admin_id: str = Query(...),
    semester_number: int = Query(...),
    file: UploadFile = File(...)
):
    """
    Upload a generated hall ticket PDF and store metadata in Firestore
    
    Request:
        - file: PDF file content
        - admin_id: Admin who is uploading
        - semester_number: Semester for this ticket
    
    Returns:
        - downloadUrl: Firebase Storage download URL
        - documentId: Firestore document ID
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, storage, firestore
        from datetime import datetime
        
        # Initialize Firebase
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred, {
                'storageBucket': os.getenv('VITE_FIREBASE_STORAGE_BUCKET')
            })
        
        # Read PDF file content
        pdf_content = await file.read()
        
        timestamp = int(datetime.now().timestamp() * 1000)
        storage_path = f"hall-tickets/{usn}/{timestamp}.pdf"
        doc_id = f"{usn}_{semester_number}_{timestamp}"
        download_url = None
        
        # Try Firebase Storage first
        try:
            bucket = storage.bucket()
            blob = bucket.blob(storage_path)
            
            blob.upload_from_string(
                pdf_content,
                content_type='application/pdf'
            )
            
            # Generate download URL (with long expiration)
            download_url = blob.generate_signed_url(
                version='v4',
                expiration=timedelta(days=365),
                method='GET'
            )
            logger.info(f"Uploaded hall ticket for {usn} to Firebase Storage: {storage_path}")
            
        except Exception as e:
            logger.warning(f"Firebase Storage upload failed: {e}. Using backend file storage fallback.")
            # Fallback: Save to backend server
            try:
                backend_storage_dir = Path(__file__).parent / "storage" / "hall_tickets" / usn
                backend_storage_dir.mkdir(parents=True, exist_ok=True)
                backend_file_path = backend_storage_dir / f"{timestamp}.pdf"
                
                with open(backend_file_path, 'wb') as f:
                    f.write(pdf_content)
                
                # Use backend API endpoint for download
                download_url = f"/api/hall-tickets/download/{usn}/{timestamp}.pdf"
                logger.info(f"Uploaded hall ticket for {usn} to backend storage: {backend_file_path}")
                
            except Exception as backend_error:
                logger.error(f"Backend file storage also failed: {backend_error}")
                raise HTTPException(status_code=500, detail=f"Failed to save hall ticket: {backend_error}")
        
        # Save metadata to Firestore
        db = firestore.client()
        
        db.collection('hall_tickets').document(doc_id).set({
            'usn': usn,
            'semesterNumber': semester_number,
            'generatedAt': datetime.now(),
            'generatedBy': admin_id,
            'pdfUrl': download_url,
            'storagePath': storage_path,
            'fileName': file.filename,
            'fileSize': len(pdf_content),
            'storageBackend': 'firebase' if download_url and 'firebasestorage' in download_url else 'backend'
        })
        
        logger.info(f"Uploaded hall ticket for {usn} to {storage_path}")
        
        return {
            'success': True,
            'downloadUrl': download_url,
            'documentId': doc_id,
            'semesterNumber': semester_number,
            'generatedAt': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to upload hall ticket for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/hall-tickets/{usn}/latest")
async def get_latest_hall_ticket(usn: str):
    """
    Fetch the latest hall ticket for a student
    
    Returns:
        - downloadUrl: URL to download the PDF
        - semesterNumber: Semester of the ticket
        - generatedAt: When the ticket was generated
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Initialize Firebase
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        # Query latest hall ticket for this USN
        query = db.collection('hall_tickets')\
            .where('usn', '==', usn)\
            .order_by('generatedAt', direction=firestore.Query.DESCENDING)\
            .limit(1)
        
        docs = query.stream()
        
        for doc in docs:
            data = doc.to_dict()
            return {
                'downloadUrl': data.get('pdfUrl'),
                'semesterNumber': data.get('semesterNumber'),
                'generatedAt': data.get('generatedAt').isoformat() if data.get('generatedAt') else None,
                'documentId': doc.id
            }
        
        # No hall ticket found
        return None
        
    except Exception as e:
        logger.error(f"Failed to fetch hall ticket for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/hall-tickets/{usn}/all")
async def get_all_hall_tickets(usn: str):
    """
    Fetch all hall tickets for a student
    
    Returns:
        - List of hall tickets with downloadUrl, semesterNumber, generatedAt
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Initialize Firebase
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        # Query all hall tickets for this USN
        query = db.collection('hall_tickets')\
            .where('usn', '==', usn)\
            .order_by('generatedAt', direction=firestore.Query.DESCENDING)
        
        docs = query.stream()
        
        tickets = []
        for doc in docs:
            data = doc.to_dict()
            tickets.append({
                'documentId': doc.id,
                'downloadUrl': data.get('pdfUrl'),
                'semesterNumber': data.get('semesterNumber'),
                'generatedAt': data.get('generatedAt').isoformat() if data.get('generatedAt') else None,
                'generatedBy': data.get('generatedBy')
            })
        
        return tickets
        
    except Exception as e:
        logger.error(f"Failed to fetch hall tickets for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/hall-tickets/backend-save')
async def save_hall_ticket_to_backend(
    usn: str = Form(...),
    semesterNumber: int = Form(...),
    generatedBy: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Save hall ticket PDF to backend storage folder
    """
    try:
        # Create storage directory structure
        storage_dir = Path(__file__).parent / 'storage' / 'hall_tickets' / usn
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        # Read PDF file content
        pdf_content = await file.read()
        
        # Save with timestamp
        timestamp = int(datetime.now().timestamp() * 1000)
        filename = f'HallTicket_Sem{semesterNumber}_{timestamp}.pdf'
        filepath = storage_dir / filename
        
        # Write PDF to disk
        with open(filepath, 'wb') as f:
            f.write(pdf_content)
        
        logger.info(f"Hall ticket saved for {usn}: {filepath}")
        
        return {
            'success': True,
            'usn': usn,
            'semesterNumber': semesterNumber,
            'fileName': filename,
            'fileSize': len(pdf_content),
            'storagePath': str(filepath),
            'downloadUrl': f'http://localhost:8000/api/hall-tickets/download/{usn}/{filename}'
        }
    except Exception as e:
        logger.error(f"Failed to save hall ticket for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/hall-tickets/download/{usn}/{filename}')
async def download_hall_ticket(usn: str, filename: str):
    """
    Download hall ticket PDF from backend storage
    """
    try:
        filepath = Path(__file__).parent / 'storage' / 'hall_tickets' / usn / filename
        
        # Security check: ensure file exists and is in the correct directory
        if not filepath.exists():
            raise HTTPException(status_code=404, detail='Hall ticket not found')
        
        if not filepath.is_file():
            raise HTTPException(status_code=400, detail='Invalid file request')
        
        # Read and return file
        with open(filepath, 'rb') as f:
            pdf_content = f.read()
        
        from fastapi.responses import FileResponse
        return FileResponse(
            filepath,
            media_type='application/pdf',
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download hall ticket for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/hall-tickets/latest/{usn}')
async def get_latest_hall_ticket(usn: str):
    """
    Get the latest hall ticket file info for a student
    """
    try:
        storage_dir = Path(__file__).parent / 'storage' / 'hall_tickets' / usn
        
        if not storage_dir.exists():
            raise HTTPException(status_code=404, detail='No hall tickets found')
        
        # Get all PDFs and find the latest by modification time
        pdf_files = list(storage_dir.glob('*.pdf'))
        
        if not pdf_files:
            raise HTTPException(status_code=404, detail='No hall tickets found')
        
        # Sort by modification time (newest first)
        latest_file = max(pdf_files, key=lambda p: p.stat().st_mtime)
        
        return {
            'fileName': latest_file.name,
            'fileSize': latest_file.stat().st_size,
            'downloadUrl': f'http://localhost:8000/api/hall-tickets/download/{usn}/{latest_file.name}',
            'modifiedAt': datetime.fromtimestamp(latest_file.stat().st_mtime).isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get latest hall ticket for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/report-submissions/upload")
async def upload_report_submission(
    file: UploadFile = File(...),
    student_id: str = Form(...),
    student_name: str = Form(...),
    category: str = Form(default="general")
):
    """
    Upload report PDF submission with fallback to backend storage if Firebase fails
    """
    try:
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        pdf_content = await file.read()
        
        if len(pdf_content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        import urllib.parse
        timestamp = int(datetime.now().timestamp() * 1000)
        # Remove special characters from filename
        safe_filename = "".join(c if c.isalnum() or c in '._-' else '_' for c in file.filename)
        firebase_path = f"no-due-submissions/{student_id}/{student_id}_{timestamp}_{safe_filename}"
        download_url = None
        storage_backend = "unknown"
        
        # Try Firebase Storage first
        try:
            bucket = storage.bucket()
            blob = bucket.blob(firebase_path)
            
            blob.upload_from_string(
                pdf_content,
                content_type='application/pdf'
            )
            
            # Generate download URL (with long expiration)
            download_url = blob.generate_signed_url(
                version='v4',
                expiration=timedelta(days=365),
                method='GET'
            )
            storage_backend = "firebase"
            logger.info(f"Uploaded report for {student_id} to Firebase Storage: {firebase_path}")
            
        except Exception as firebase_error:
            logger.warning(f"Firebase Storage upload failed: {firebase_error}. Using backend file storage fallback.")
            # Fallback: Save to backend server
            try:
                backend_storage_dir = Path(__file__).parent / "storage" / "report-submissions" / student_id
                backend_storage_dir.mkdir(parents=True, exist_ok=True)
                backend_file_path = backend_storage_dir / f"{timestamp}_{safe_filename}"
                
                with open(backend_file_path, 'wb') as f:
                    f.write(pdf_content)
                
                # Use backend API endpoint for download - URL encode the filename
                encoded_filename = urllib.parse.quote(f"{timestamp}_{safe_filename}", safe='')
                download_url = f"/api/report-submissions/download/{student_id}/{encoded_filename}"
                storage_backend = "backend"
                logger.info(f"Uploaded report for {student_id} to backend storage: {backend_file_path}")
                
            except Exception as backend_error:
                logger.error(f"Backend file storage also failed: {backend_error}")
                raise HTTPException(status_code=500, detail=f"Failed to save report: {backend_error}")
        
        return {
            'success': True,
            'downloadUrl': download_url,
            'studentId': student_id,
            'studentName': student_name,
            'fileName': file.filename,
            'fileSize': len(pdf_content),
            'uploadedAt': datetime.now().isoformat(),
            'storageBackend': storage_backend,
            'timestamp': timestamp
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload report for {student_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/api/report-submissions/download/{student_id}/{filename:path}")
async def download_report_submission(student_id: str, filename: str):
    """
    Download report submission PDF from backend storage
    """
    try:
        import urllib.parse
        # Decode the filename
        decoded_filename = urllib.parse.unquote(filename)
        
        filepath = Path(__file__).parent / 'storage' / 'report-submissions' / student_id / decoded_filename
        
        # Security check: ensure file exists and is in the correct directory
        if not filepath.exists():
            logger.warning(f"File not found: {filepath}")
            raise HTTPException(status_code=404, detail='Report not found')
        
        if not filepath.is_file():
            raise HTTPException(status_code=400, detail='Invalid file request')
        
        from fastapi.responses import FileResponse
        return FileResponse(
            filepath,
            media_type='application/pdf',
            filename=decoded_filename
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download report for {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# COURSE FEEDBACK TRACKING ENDPOINTS
# ============================================================================

@app.post('/api/feedback/parse-excel')
async def parse_feedback_excel(file: UploadFile = File(...)):
    """
    Parse course feedback Excel file
    Expected columns: USN, Course Feedback Completed (Yes/No)
    """
    try:
        import openpyxl
        import io
        
        # Read file content
        content = await file.read()
        
        # Parse Excel
        workbook = openpyxl.load_workbook(io.BytesIO(content))
        worksheet = workbook.active
        
        # Extract data
        feedbackData = []
        headers = {}
        
        logger.info(f"[FEEDBACK_PARSE] Starting Excel parse, worksheet active sheet: {worksheet.title}")
        
        # Get headers from first row
        header_row = []
        for idx, cell in enumerate(worksheet[1]):
            header = cell.value
            header_row.append(header)
            if header:
                header_lower = str(header).strip().lower()
                logger.debug(f"[FEEDBACK_PARSE] Column {idx}: '{header}' -> '{header_lower}'")
                
                # More flexible header matching
                if 'usn' in header_lower:
                    headers['usn'] = idx + 1
                    logger.info(f"[FEEDBACK_PARSE] Found USN column at index {idx + 1}")
                elif 'feedback' in header_lower and ('completed' in header_lower or 'status' in header_lower):
                    headers['completed'] = idx + 1
                    logger.info(f"[FEEDBACK_PARSE] Found Feedback Completed column at index {idx + 1}")
        
        logger.info(f"[FEEDBACK_PARSE] Headers found: {headers}")
        logger.info(f"[FEEDBACK_PARSE] Header row content: {header_row}")
        
        if not headers.get('usn') or not headers.get('completed'):
            error_detail = f"Excel must have 'USN' and 'Course Feedback Completed' columns. Found headers: {header_row}"
            logger.error(f"[FEEDBACK_PARSE] Missing required columns: {error_detail}")
            raise HTTPException(
                status_code=400,
                detail=error_detail
            )
        
        # Parse data rows
        for row_idx, row in enumerate(worksheet.iter_rows(min_row=2, values_only=False), start=2):
            try:
                usn_cell = row[headers['usn'] - 1]
                completed_cell = row[headers['completed'] - 1]
                
                usn = str(usn_cell.value or '').strip().upper()
                completed_str = str(completed_cell.value or '').strip().lower()
                
                if usn:
                    feedbackData.append({
                        'usn': usn,
                        'allFeedbackCompleted': completed_str == 'yes',
                    })
            except Exception as row_error:
                logger.warning(f"[FEEDBACK_PARSE] Error parsing row {row_idx}: {row_error}")
                continue
        
        logger.info(f"[FEEDBACK_PARSE] Parsed {len(feedbackData)} feedback records from Excel")
        
        return {
            'success': True,
            'feedbackData': feedbackData,
            'totalRecords': len(feedbackData),
        }
        
    except Exception as e:
        logger.error(f"Error parsing feedback Excel: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse Excel: {str(e)}"
        )


@app.post('/api/feedback/upload')
async def upload_feedback_data(
    department_id: str = Form(...),
    semester_number: int = Form(...),
    academic_year: str = Form(...),
    admin_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload course feedback data for students
    """
    try:
        import openpyxl
        import io
        from datetime import datetime
        
        content = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(content))
        worksheet = workbook.active
        
        # Get headers
        headers = {}
        header_row = []
        for idx, cell in enumerate(worksheet[1]):
            header = cell.value
            header_row.append(header)
            if header:
                header_lower = str(header).strip().lower()
                if 'usn' in header_lower:
                    headers['usn'] = idx + 1
                    logger.info(f"[FEEDBACK_UPLOAD] Found USN column at index {idx + 1}")
                elif 'feedback' in header_lower and ('completed' in header_lower or 'status' in header_lower):
                    headers['completed'] = idx + 1
                    logger.info(f"[FEEDBACK_UPLOAD] Found Feedback Completed column at index {idx + 1}")
        
        if not headers.get('usn') or not headers.get('completed'):
            error_detail = f"Excel must have 'USN' and 'Course Feedback Completed' columns. Found headers: {header_row}"
            logger.error(f"[FEEDBACK_UPLOAD] Missing required columns: {error_detail}")
            raise HTTPException(
                status_code=400,
                detail=error_detail
            )
        
        # Initialize Firebase
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        uploaded = 0
        failed = 0
        errors = []
        
        logger.info(f"[FEEDBACK_UPLOAD] Starting upload: dept={department_id}, sem={semester_number}, year={academic_year}")
        
        # Parse and upload
        for row_idx, row in enumerate(worksheet.iter_rows(min_row=2, values_only=False), start=2):
            try:
                usn = str(row[headers['usn'] - 1].value or '').strip().upper()
                completed_str = str(row[headers['completed'] - 1].value or '').strip().lower()
                
                if not usn:
                    logger.debug(f"[FEEDBACK_UPLOAD] Row {row_idx}: Skipping empty USN")
                    continue
                
                doc_id = f"{usn}_{department_id}_{semester_number}_{academic_year}"
                
                logger.debug(f"[FEEDBACK_UPLOAD] Processing row {row_idx}: USN={usn}, completed={completed_str}")
                
                db.collection('course_feedback_tracking').document(doc_id).set({
                    'usn': usn,
                    'departmentId': department_id,
                    'semesterNumber': semester_number,
                    'academicYear': academic_year,
                    'allFeedbackCompleted': completed_str == 'yes',
                    'completedSubjects': [],
                    'totalSubjects': 0,
                    'uploadedAt': datetime.now(),
                    'uploadedBy': admin_id,
                    'lastUpdated': datetime.now(),
                })
                uploaded += 1
                logger.info(f"[FEEDBACK_UPLOAD] ✓ Uploaded feedback for {usn}")
                
            except Exception as row_error:
                failed += 1
                errors.append(f"Row {row_idx}: {str(row_error)}")
                logger.warning(f"[FEEDBACK_UPLOAD] ✗ Error uploading feedback for row {row_idx}: {row_error}")
                continue
        
        logger.info(f"[FEEDBACK_UPLOAD] Upload complete: uploaded={uploaded}, failed={failed}")
        
        return {
            'success': True,
            'uploaded': uploaded,
            'failed': failed,
            'errors': errors,
            'message': f"Successfully uploaded {uploaded} feedback records"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading feedback data: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get('/api/feedback/students-missing/{department_id}/{semester_number}/{academic_year}')
async def get_students_missing_feedback(
    department_id: str,
    semester_number: int,
    academic_year: str
):
    """
    Get list of students who haven't completed feedback for all subjects
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        # Query students with incomplete feedback
        query = db.collection('course_feedback_tracking')\
            .where('departmentId', '==', department_id)\
            .where('semesterNumber', '==', semester_number)\
            .where('academicYear', '==', academic_year)\
            .where('allFeedbackCompleted', '==', False)
        
        docs = query.stream()
        students = []
        
        for doc in docs:
            data = doc.to_dict()
            students.append({
                'usn': data.get('usn'),
                'allFeedbackCompleted': data.get('allFeedbackCompleted'),
            })
        
        return {
            'success': True,
            'students': students,
            'totalCount': len(students),
        }
        
    except Exception as e:
        logger.error(f"Error fetching students missing feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/feedback/student/{usn}/{department_id}/{semester_number}')
async def get_student_feedback_status(
    usn: str,
    department_id: str,
    semester_number: int
):
    """
    Get course feedback completion status for a student
    Used by student dashboard to show if they've completed feedback
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[FEEDBACK] Fetching feedback status: usn={usn}, dept={department_id}, sem={semester_number}")
        
        # Query feedback status for the student
        query = db.collection('course_feedback_tracking')\
            .where('usn', '==', usn)\
            .where('departmentId', '==', department_id)\
            .where('semesterNumber', '==', semester_number)
        
        docs = list(query.stream())
        
        if docs:
            data = docs[0].to_dict()
            logger.info(f"[FEEDBACK] Found feedback status: usn={usn}, completed={data.get('allFeedbackCompleted')}")
            return {
                'success': True,
                'usn': usn,
                'allFeedbackCompleted': data.get('allFeedbackCompleted', False),
                'departmentId': data.get('departmentId'),
                'semesterNumber': data.get('semesterNumber'),
                'academicYear': data.get('academicYear'),
                'uploadedAt': data.get('uploadedAt').isoformat() if data.get('uploadedAt') else None,
            }
        
        logger.info(f"[FEEDBACK] No feedback status found: usn={usn}")
        return {
            'success': True,
            'usn': usn,
            'allFeedbackCompleted': False,
            'departmentId': department_id,
            'semesterNumber': semester_number,
            'message': 'No feedback data found for this student',
        }
        
    except Exception as e:
        logger.error(f"[FEEDBACK] Error fetching student feedback status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# BACKLOG MANAGEMENT ENDPOINTS
# ============================================================================

@app.get('/api/backlogs/department/{department_id}/{semester_number}')
async def get_department_backlogs(department_id: str, semester_number: int):
    """
    Get all pending backlogs for a specific department and semester
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[BACKLOG] Fetching backlogs: dept={department_id}, sem={semester_number}")
        
        # Query pending backlogs
        query = db.collection('backlogs')\
            .where('departmentId', '==', department_id)\
            .where('semesterNumber', '==', semester_number)\
            .where('status', '==', 'pending')\
            .order_by('createdAt', direction=firestore.Query.DESCENDING)
        
        docs = query.stream()
        backlogs = []
        
        for doc in docs:
            data = doc.to_dict()
            backlogs.append({
                'id': doc.id,
                'usn': data.get('usn'),
                'subjectCode': data.get('subjectCode'),
                'subjectName': data.get('subjectName'),
                'departmentId': data.get('departmentId'),
                'semesterNumber': data.get('semesterNumber'),
                'status': data.get('status'),
                'createdAt': data.get('createdAt').isoformat() if data.get('createdAt') else None,
                'createdBy': data.get('createdBy'),
                'clearedAt': data.get('clearedAt').isoformat() if data.get('clearedAt') else None,
                'clearedBy': data.get('clearedBy'),
                'notes': data.get('notes'),
            })
        
        logger.info(f"[BACKLOG] Found {len(backlogs)} backlogs for dept={department_id}, sem={semester_number}")
        
        return {
            'success': True,
            'backlogs': backlogs,
            'totalCount': len(backlogs),
        }
        
    except Exception as e:
        logger.error(f"Error fetching department backlogs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/backlogs/add')
async def add_backlog(
    usn: str = Form(...),
    subject_code: str = Form(...),
    subject_name: str = Form(...),
    department_id: str = Form(...),
    semester_number: int = Form(...),
    admin_id: str = Form(...),
    notes: str = Form(default="")
):
    """
    Add a new backlog for a student
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[BACKLOG] Adding backlog: usn={usn}, code={subject_code}, dept={department_id}, sem={semester_number}")
        
        # Add backlog document
        doc_ref = db.collection('backlogs').add({
            'usn': usn,
            'subjectCode': subject_code,
            'subjectName': subject_name,
            'departmentId': department_id,
            'semesterNumber': semester_number,
            'status': 'pending',
            'createdAt': datetime.now(),
            'createdBy': admin_id,
            'notes': notes or None,
        })
        
        doc_id = doc_ref[1].id
        logger.info(f"[BACKLOG] ✓ Backlog added successfully: docId={doc_id}, usn={usn}")
        
        return {
            'success': True,
            'backlogId': doc_id,
            'usn': usn,
            'subjectCode': subject_code,
            'message': f"Backlog added for {usn}",
        }
        
    except Exception as e:
        logger.error(f"[BACKLOG] ✗ Error adding backlog: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/backlogs/{backlog_id}/mark-cleared')
async def mark_backlog_cleared(
    backlog_id: str,
    admin_id: str = Form(...)
):
    """
    Mark a backlog as cleared
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[BACKLOG] Marking cleared: backlogId={backlog_id}, admin={admin_id}")
        
        # Update backlog status
        db.collection('backlogs').document(backlog_id).update({
            'status': 'cleared',
            'clearedAt': datetime.now(),
            'clearedBy': admin_id,
        })
        
        logger.info(f"[BACKLOG] ✓ Backlog marked as cleared: backlogId={backlog_id}")
        
        return {
            'success': True,
            'backlogId': backlog_id,
            'message': 'Backlog marked as cleared',
        }
        
    except Exception as e:
        logger.error(f"[BACKLOG] ✗ Error marking backlog cleared: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FEE PAID STATUS ENDPOINTS
# ============================================================================

@app.post('/api/fee-paid-status/upload')
async def upload_fee_paid_status(
    department_id: str = Form(...),
    admin_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload fee paid status for students
    Excel file should have columns: USN, Fee Paid (Yes/No)
    """
    try:
        import openpyxl
        import io
        from datetime import datetime
        
        content = await file.read()
        workbook = openpyxl.load_workbook(io.BytesIO(content))
        worksheet = workbook.active
        
        # Get headers
        headers = {}
        header_row = []
        for idx, cell in enumerate(worksheet[1]):
            header = cell.value
            header_row.append(header)
            if header:
                header_lower = str(header).strip().lower()
                if 'usn' in header_lower:
                    headers['usn'] = idx + 1
                    logger.info(f"[FEE_STATUS_UPLOAD] Found USN column at index {idx + 1}")
                elif 'fee' in header_lower and ('paid' in header_lower or 'status' in header_lower):
                    headers['fee_paid'] = idx + 1
                    logger.info(f"[FEE_STATUS_UPLOAD] Found Fee Paid column at index {idx + 1}")
        
        if not headers.get('usn') or not headers.get('fee_paid'):
            error_detail = f"Excel must have 'USN' and 'Fee Paid' columns. Found headers: {header_row}"
            logger.error(f"[FEE_STATUS_UPLOAD] Missing required columns: {error_detail}")
            raise HTTPException(
                status_code=400,
                detail=error_detail
            )
        
        # Initialize Firebase
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        uploaded = 0
        failed = 0
        errors = []
        
        logger.info(f"[FEE_STATUS_UPLOAD] Starting upload: dept={department_id}")
        
        # Parse and upload
        for row_idx, row in enumerate(worksheet.iter_rows(min_row=2, values_only=False), start=2):
            try:
                usn = str(row[headers['usn'] - 1].value or '').strip().upper()
                fee_paid_str = str(row[headers['fee_paid'] - 1].value or '').strip().lower()
                
                if not usn:
                    logger.debug(f"[FEE_STATUS_UPLOAD] Row {row_idx}: Skipping empty USN")
                    continue
                
                # Parse fee paid status (Yes/No)
                fee_paid = fee_paid_str == 'yes'
                
                doc_id = f"{usn}_{department_id}"
                
                logger.debug(f"[FEE_STATUS_UPLOAD] Processing row {row_idx}: USN={usn}, feePaid={fee_paid}")
                
                db.collection('fee_paid_status').document(doc_id).set({
                    'usn': usn,
                    'departmentId': department_id,
                    'feePaid': fee_paid,
                    'uploadedAt': datetime.now(),
                    'uploadedBy': admin_id,
                })
                uploaded += 1
                logger.info(f"[FEE_STATUS_UPLOAD] ✓ Uploaded fee status for {usn}")
                
            except Exception as row_error:
                failed += 1
                errors.append(f"Row {row_idx}: {str(row_error)}")
                logger.warning(f"[FEE_STATUS_UPLOAD] ✗ Error uploading fee status for row {row_idx}: {row_error}")
                continue
        
        logger.info(f"[FEE_STATUS_UPLOAD] Upload complete: uploaded={uploaded}, failed={failed}")
        
        return {
            'success': True,
            'uploaded': uploaded,
            'failed': failed,
            'errors': errors,
            'message': f"Successfully uploaded {uploaded} fee paid records"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading fee paid status: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get('/api/fee-paid-status/{usn}/{department_id}')
async def get_fee_paid_status(usn: str, department_id: str):
    """
    Get fee paid status for a student
    """
    try:
        print(f"\n[FEE_STATUS] Fetching: usn={usn}, dept={department_id}")
        
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Initialize Firebase if needed
        try:
            if not firebase_admin._apps:
                cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
        except ValueError:
            pass  # Already initialized
        
        db = firestore.client()
        
        # Normalize USN
        usn_normalized = usn.strip().upper()
        doc_id = f"{usn_normalized}_{department_id}"
        print(f"[FEE_STATUS] Looking for: {doc_id}")
        
        # Query Firestore
        doc_ref = db.collection('fee_paid_status').document(doc_id)
        doc = doc_ref.get()
        
        print(f"[FEE_STATUS] Got document, checking if exists...")
        
        # Check if document exists
        if doc and hasattr(doc, 'exists') and doc.exists:
            print(f"[FEE_STATUS] Document exists")
            data = doc.to_dict()
            print(f"[FEE_STATUS] Data: {data}")
            fee_paid = data.get('feePaid') if data else None
            print(f"[FEE_STATUS] Fee paid: {fee_paid}, returning success")
            return {
                'success': True,
                'usn': usn,
                'departmentId': department_id,
                'feePaid': fee_paid,
            }
        else:
            print(f"[FEE_STATUS] Document does not exist")
            return {
                'success': True,
                'usn': usn,
                'departmentId': department_id,
                'feePaid': None,
            }
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"[FEE_STATUS] ERROR: {error_msg}")
        import traceback
        print(traceback.format_exc())
        logger.error(f"[FEE_STATUS] {error_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)


# ============================================================================
# CERTIFICATE UPLOAD ENDPOINTS
# ============================================================================

@app.post('/api/certificates/upload')
async def upload_certificate(
    usn: str = Form(...),
    certificateName: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload a certificate for a student
    Stores file in backend storage/certificates/{usn}/
    
    Parameters:
    - usn: Student's USN
    - certificateName: Name of the certificate (e.g., "Sports Certificate", "Cultural Achievement")
    - file: PDF or image file
    """
    try:
        # Validate file type
        allowed_extensions = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'}
        file_ext = Path(file.filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file_ext} not allowed. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Validate file size (max 10MB)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="File size exceeds 10MB limit"
            )
        
        # Create storage directory
        storage_dir = Path(__file__).parent / 'storage' / 'certificates' / usn
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        timestamp = int(datetime.now().timestamp() * 1000)
        original_name = Path(file.filename).stem
        filename = f"{certificateName.replace(' ', '_')}_{timestamp}{file_ext}"
        filepath = storage_dir / filename
        
        # Save file
        with open(filepath, 'wb') as f:
            f.write(file_content)
        
        logger.info(f"Certificate uploaded for {usn}: {filepath}")
        
        return {
            'success': True,
            'usn': usn,
            'certificateName': certificateName,
            'filename': filename,
            'fileSize': len(file_content),
            'uploadedAt': datetime.now().isoformat(),
            'downloadUrl': f'http://localhost:8000/api/certificates/download/{usn}/{filename}'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading certificate for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/certificates/download/{usn}/{filename}')
async def download_certificate(usn: str, filename: str):
    """
    Download a certificate file
    """
    try:
        filepath = Path(__file__).parent / 'storage' / 'certificates' / usn / filename
        
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        # Security check: ensure the filename is valid
        if '..' in filename or '/' in filename or '\\' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        from fastapi.responses import FileResponse
        return FileResponse(
            filepath,
            filename=filename,
            media_type='application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading certificate for {usn}/{filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/certificates/list/{usn}')
async def list_certificates(usn: str):
    """
    List all certificates uploaded by a student
    """
    try:
        storage_dir = Path(__file__).parent / 'storage' / 'certificates' / usn
        
        if not storage_dir.exists():
            return {
                'success': True,
                'usn': usn,
                'certificates': [],
                'totalCount': 0
            }
        
        certificates = []
        for filepath in sorted(storage_dir.glob('*'), reverse=True):
            if filepath.is_file():
                file_ext = filepath.suffix
                cert_name = filepath.stem.rsplit('_', 1)[0].replace('_', ' ')  # Extract certificate name
                
                certificates.append({
                    'filename': filepath.name,
                    'certificateName': cert_name,
                    'fileSize': filepath.stat().st_size,
                    'uploadedAt': datetime.fromtimestamp(filepath.stat().st_mtime).isoformat(),
                    'fileType': file_ext,
                    'downloadUrl': f'http://localhost:8000/api/certificates/download/{usn}/{filepath.name}'
                })
        
        return {
            'success': True,
            'usn': usn,
            'certificates': certificates,
            'totalCount': len(certificates)
        }
        
    except Exception as e:
        logger.error(f"Error listing certificates for {usn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/api/certificates/delete/{usn}/{filename}')
async def delete_certificate(usn: str, filename: str):
    """
    Delete a certificate file
    """
    try:
        # Security check: ensure the filename is valid
        if '..' in filename or '/' in filename or '\\' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        filepath = Path(__file__).parent / 'storage' / 'certificates' / usn / filename
        
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        filepath.unlink()
        logger.info(f"Certificate deleted for {usn}: {filepath}")
        
        return {
            'success': True,
            'usn': usn,
            'filename': filename,
            'message': 'Certificate deleted successfully'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting certificate for {usn}/{filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/certificates/department/{department_id}')
async def list_department_certificates(department_id: str):
    """
    List all certificates uploaded by students in a specific department.
    Includes student USN, name, certificate name, and download URL.
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Initialize Firebase
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        # Get all students in the department
        db = firestore.client()
        students_ref = db.collection('students')
        query = students_ref.where('departmentId', '==', department_id)
        students_docs = query.stream()
        
        all_certificates = []
        
        for student_doc in students_docs:
            student_data = student_doc.to_dict()
            usn = student_data.get('usn')
            student_name = student_data.get('name', 'Unknown')
            
            # Get certificates for this student
            storage_dir = Path(__file__).parent / 'storage' / 'certificates' / usn
            
            if storage_dir.exists():
                for filepath in sorted(storage_dir.glob('*'), reverse=True):
                    if filepath.is_file():
                        file_ext = filepath.suffix
                        cert_name = filepath.stem.rsplit('_', 1)[0].replace('_', ' ')
                        
                        all_certificates.append({
                            'usn': usn,
                            'studentName': student_name,
                            'certificateName': cert_name,
                            'filename': filepath.name,
                            'fileSize': filepath.stat().st_size,
                            'uploadedAt': datetime.fromtimestamp(filepath.stat().st_mtime).isoformat(),
                            'fileType': file_ext,
                            'downloadUrl': f'/api/certificates/download/{usn}/{filepath.name}'
                        })
        
        return {
            'success': True,
            'departmentId': department_id,
            'certificates': all_certificates,
            'totalCount': len(all_certificates)
        }
        
    except Exception as e:
        logger.error(f"Error listing certificates for department {department_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# REPORT TEMPLATE DOWNLOAD
# ============================================================================

@app.get('/api/templates/report-content-format')
async def download_report_content_template():
    """
    Download the report content format template
    Located at: backend/templates/report_content_format.docx
    """
    try:
        template_path = Path(__file__).parent / 'templates' / 'report_content_format.docx'
        
        if not template_path.exists():
            raise HTTPException(
                status_code=404,
                detail="Report content format template not found"
            )
        
        from fastapi.responses import FileResponse
        return FileResponse(
            template_path,
            filename='report_content_format.docx',
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading report template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PRINT REQUEST ENDPOINTS
# ============================================================================

@app.post('/api/print-requests/create')
async def create_print_request(
    student_id: str = Form(...),
    student_name: str = Form(...),
    student_reg_no: str = Form(...),
    student_dept: str = Form(...),
    student_email: str = Form(...),
    submission_id: str = Form(...),
    submission_title: str = Form(...),
    pdf_url: str = Form(...),
    pdf_name: str = Form(...),
    copies: int = Form(1),
    color_mode: str = Form('bw'),
    sides: str = Form('single'),
):
    """
    Create a new print request for a student submission
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[PRINT] Creating print request: student={student_id}, submission={submission_id}")
        
        # Create print request document
        print_request = {
            'submissionId': submission_id,
            'submissionTitle': submission_title,
            'pdfUrl': pdf_url,
            'pdfName': pdf_name,
            'studentId': student_id,
            'studentName': student_name,
            'studentRegNo': student_reg_no,
            'studentDept': student_dept,
            'studentEmail': student_email,
            'printOptions': {
                'copies': copies,
                'colorMode': color_mode,
                'sides': sides,
            },
            'status': 'pending',
            'createdAt': datetime.now(),
            'updatedAt': datetime.now(),
        }
        
        doc_ref = db.collection('printRequests').add(print_request)
        doc_id = doc_ref[1].id
        
        logger.info(f"[PRINT] ✓ Print request created: {doc_id}")
        
        return {
            'success': True,
            'requestId': doc_id,
            'studentId': student_id,
            'submissionId': submission_id,
            'message': 'Print request created successfully',
        }
        
    except Exception as e:
        logger.error(f"[PRINT] ✗ Error creating print request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/print-requests/submission/{submission_id}')
async def get_print_request_by_submission(submission_id: str):
    """
    Get print request by submission ID (check if print already requested)
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[PRINT] Fetching print request for submission: {submission_id}")
        
        # Query print request by submission ID
        query = db.collection('printRequests')\
            .where('submissionId', '==', submission_id)
        
        docs = list(query.stream())
        
        if not docs:
            logger.info(f"[PRINT] No print request found for submission: {submission_id}")
            return {
                'success': True,
                'printRequest': None,
                'submissionId': submission_id,
            }
        
        doc = docs[0]
        data = doc.to_dict()
        
        # Convert timestamps to ISO format
        if isinstance(data.get('createdAt'), datetime):
            data['createdAt'] = data['createdAt'].isoformat()
        if isinstance(data.get('updatedAt'), datetime):
            data['updatedAt'] = data['updatedAt'].isoformat()
        if isinstance(data.get('completedAt'), datetime):
            data['completedAt'] = data['completedAt'].isoformat()
        
        logger.info(f"[PRINT] Found print request: {doc.id}, status={data.get('status')}")
        
        return {
            'success': True,
            'printRequest': {
                'id': doc.id,
                **data,
            },
            'submissionId': submission_id,
        }
        
    except Exception as e:
        logger.error(f"[PRINT] Error fetching print request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/print-requests/student/{student_id}')
async def get_student_print_requests(student_id: str):
    """
    Get all print requests for a student
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[PRINT] Fetching print requests for student: {student_id}")
        
        # Query print requests for student
        query = db.collection('printRequests')\
            .where('studentId', '==', student_id)\
            .order_by('createdAt', direction=firestore.Query.DESCENDING)
        
        docs = query.stream()
        print_requests = []
        
        for doc in docs:
            data = doc.to_dict()
            
            # Convert timestamps to ISO format
            if isinstance(data.get('createdAt'), datetime):
                data['createdAt'] = data['createdAt'].isoformat()
            if isinstance(data.get('updatedAt'), datetime):
                data['updatedAt'] = data['updatedAt'].isoformat()
            if isinstance(data.get('completedAt'), datetime):
                data['completedAt'] = data['completedAt'].isoformat()
            
            print_requests.append({
                'id': doc.id,
                **data,
            })
        
        logger.info(f"[PRINT] Found {len(print_requests)} print requests for student: {student_id}")
        
        return {
            'success': True,
            'printRequests': print_requests,
            'studentId': student_id,
            'totalCount': len(print_requests),
        }
        
    except Exception as e:
        logger.error(f"[PRINT] Error fetching student print requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/print-requests/all')
async def get_all_print_requests(status: str = None):
    """
    Get all print requests (for reprography admin dashboard)
    Optional filter by status: pending, in-progress, completed, cancelled
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[PRINT] Fetching all print requests (status filter: {status})")
        
        # Build query
        query = db.collection('printRequests')
        
        if status and status in ['pending', 'in-progress', 'completed', 'cancelled']:
            query = query.where('status', '==', status)
        
        # Order by creation date (newest first)
        query = query.order_by('createdAt', direction=firestore.Query.DESCENDING)
        
        docs = query.stream()
        print_requests = []
        
        for doc in docs:
            data = doc.to_dict()
            
            # Convert timestamps to ISO format
            if isinstance(data.get('createdAt'), datetime):
                data['createdAt'] = data['createdAt'].isoformat()
            if isinstance(data.get('updatedAt'), datetime):
                data['updatedAt'] = data['updatedAt'].isoformat()
            if isinstance(data.get('completedAt'), datetime):
                data['completedAt'] = data['completedAt'].isoformat()
            
            print_requests.append({
                'id': doc.id,
                **data,
            })
        
        logger.info(f"[PRINT] Found {len(print_requests)} print requests")
        
        return {
            'success': True,
            'printRequests': print_requests,
            'totalCount': len(print_requests),
            'statusFilter': status,
        }
        
    except Exception as e:
        logger.error(f"[PRINT] Error fetching all print requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/print-requests/{request_id}/status')
async def update_print_request_status(
    request_id: str,
    status: str = Form(...),
    processed_by: str = Form(...),
    admin_notes: str = Form(default=""),
):
    """
    Update print request status (for reprography admin)
    Status values: pending, in-progress, completed, cancelled
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        logger.info(f"[PRINT] Updating print request status: {request_id} -> {status}")
        
        # Validate status
        valid_statuses = ['pending', 'in-progress', 'completed', 'cancelled']
        if status not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        # Update document
        update_data = {
            'status': status,
            'processedBy': processed_by,
            'updatedAt': datetime.now(),
        }
        
        if admin_notes:
            update_data['adminNotes'] = admin_notes
        
        if status == 'completed':
            update_data['completedAt'] = datetime.now()
        
        db.collection('printRequests').document(request_id).update(update_data)
        
        logger.info(f"[PRINT] ✓ Print request status updated: {request_id}")
        
        return {
            'success': True,
            'requestId': request_id,
            'status': status,
            'message': 'Print request status updated successfully',
        }
        
    except Exception as e:
        logger.error(f"[PRINT] ✗ Error updating print request status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
