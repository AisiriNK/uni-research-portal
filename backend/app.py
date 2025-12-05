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
from datetime import datetime
import logging
import tempfile
import zipfile
import io
from pathlib import Path
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
    guide_name: str = Form(...),
    year: str = Form(...),
    team_members_json: str = Form(...)
):
    """Process uploaded document and generate LaTeX files"""
    
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
            year=year,
            team_members=team_members
        )
        
        # Read file content
        content = await file.read()
        
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
            "file_count": len(generated_files)
        }
        
    except Exception as e:
        logger.error(f"Error processing document: {e}")
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

@app.post("/api/download-latex-project")
async def download_latex_project(
    file: UploadFile = File(...),
    project_title: str = Form(...),
    guide_name: str = Form(...),
    year: str = Form(...),
    team_members_json: str = Form(...)
):
    """Process document and return a ZIP file with all LaTeX files"""
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
