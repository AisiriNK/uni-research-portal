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

    prompt = f"""You are a report quality validator. Analyze the report text and return JSON only.

Rules:
- Check spelling errors, capitalization issues, and grammar problems.
- Check that every figure has a caption and is referenced in an explanation paragraph.
- Check that every table has a caption and is referenced in an explanation paragraph.
- Tag issues with severity: warning or critical.

Context:
Image count: {stats.get('image_count', 0)}
Figure captions found: {len(stats.get('figure_captions', []))}
Table captions found: {len(stats.get('table_captions', []))}

Return JSON in this exact shape:
{{
  "issues": [
    {{"severity":"warning|critical","label":"...","message":"...","suggestion":"..."}}
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

Return ONLY a JSON array with this structure:
[{{"title": "...", "description": "...", "justification": "...", "confidence": 0.8, "category": "methodology|dataset|application|theory"}}]"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2048
        )
        
        result_text = response.choices[0].message.content
        
        # Try to parse JSON from response
        try:
            # Extract JSON if wrapped in markdown code blocks
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            gaps = json.loads(result_text)
            
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
        
        # Upload to Firebase Storage
        bucket = storage.bucket()
        timestamp = int(datetime.now().timestamp() * 1000)
        storage_path = f"hall-tickets/{usn}/{timestamp}.pdf"
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
        
        # Save metadata to Firestore
        db = firestore.client()
        doc_id = f"{usn}_{semester_number}_{timestamp}"
        
        db.collection('hall_tickets').document(doc_id).set({
            'usn': usn,
            'semesterNumber': semester_number,
            'generatedAt': datetime.now(),
            'generatedBy': admin_id,
            'pdfUrl': download_url,
            'storagePath': storage_path,
            'fileName': file.filename,
            'fileSize': len(pdf_content)
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
