"""
Research Hub Backend - FastAPI Application
Integrates OpenAlex API for paper fetching and Groq AI for intelligent clustering
"""

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
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

def parse_docx_into_chapters(content: str) -> List[dict]:
    """
    Parse document content into chapters using regex pattern 'CHAPTER *'
    Returns list of chapters with placeholders for images, properly ordered
    """
    import re
    
    logger.info(f"Starting chapter parsing. Content length: {len(content)} characters")
    
    # Enhanced chapter detection patterns
    chapter_patterns = [
        r'(?i)CHAPTER\s+(\d+)[:\-\.\s]*([^\n]*)',  # CHAPTER 1: Title or CHAPTER 1 Title
        r'(?i)CHAPTER\s*[:\-\.]?\s*(\d+)[:\-\.\s]*([^\n]*)',  # CHAPTER: 1 Title
        r'(?i)(\d+)\.\s*CHAPTER[:\-\.\s]*([^\n]*)',  # 1. CHAPTER: Title
        r'(?i)CHAPTER\s*([IVXLCDM]+)[:\-\.\s]*([^\n]*)',  # CHAPTER I: Title (Roman numerals)
    ]
    
    # Find all chapter matches with their positions
    chapter_matches = []
    
    for pattern in chapter_patterns:
        matches = re.finditer(pattern, content, re.MULTILINE)
        for match in matches:
            # Extract chapter number and title
            groups = match.groups()
            if len(groups) >= 2:
                chapter_num_str = groups[0].strip()
                chapter_title = groups[1].strip()
                
                # Convert Roman numerals to integers if needed
                if re.match(r'^[IVXLCDM]+$', chapter_num_str.upper()):
                    chapter_num = roman_to_int(chapter_num_str.upper())
                else:
                    try:
                        chapter_num = int(chapter_num_str)
                    except ValueError:
                        continue
                
                chapter_matches.append({
                    'start_pos': match.start(),
                    'end_pos': match.end(),
                    'chapter_number': chapter_num,
                    'title': chapter_title if chapter_title else f"Chapter {chapter_num}",
                    'match_text': match.group(0)
                })
    
    # If no specific chapter patterns found, try a simpler approach
    if not chapter_matches:
        logger.info("No specific chapter patterns found, trying simpler approach")
        simple_pattern = r'(?i)(CHAPTER[^\n]*)'
        matches = re.finditer(simple_pattern, content, re.MULTILINE)
        for i, match in enumerate(matches):
            chapter_matches.append({
                'start_pos': match.start(),
                'end_pos': match.end(),
                'chapter_number': i + 1,
                'title': match.group(1).strip(),
                'match_text': match.group(0)
            })
    
    # Sort chapters by their position in the document
    chapter_matches.sort(key=lambda x: x['start_pos'])
    
    logger.info(f"Found {len(chapter_matches)} chapter markers")
    
    if not chapter_matches:
        # No chapters found, treat entire document as single chapter
        logger.info("No chapters detected, treating as single document")
        return [{
            'chapter_number': 1,
            'title': 'Document Content',
            'content': process_chapter_content(content, 1),
            'image_count': count_images_in_content(content)
        }]
    
    parsed_chapters = []
    
    for i, chapter_match in enumerate(chapter_matches):
        # Determine chapter content boundaries
        content_start = chapter_match['end_pos']
        
        # Content ends at the start of next chapter or end of document
        if i + 1 < len(chapter_matches):
            content_end = chapter_matches[i + 1]['start_pos']
        else:
            content_end = len(content)
        
        # Extract chapter content
        chapter_content = content[content_start:content_end].strip()
        
        # Process the content (handle images, clean formatting)
        processed_content = process_chapter_content(chapter_content, chapter_match['chapter_number'])
        
        # Count images in this chapter
        image_count = count_images_in_content(processed_content)
        
        parsed_chapters.append({
            'chapter_number': chapter_match['chapter_number'],
            'title': clean_chapter_title(chapter_match['title']),
            'content': processed_content,
            'image_count': image_count
        })
        
        logger.info(f"Parsed Chapter {chapter_match['chapter_number']}: {chapter_match['title'][:50]}... ({len(processed_content)} chars, {image_count} images)")
    
    # Sort chapters by chapter number to ensure proper order
    parsed_chapters.sort(key=lambda x: x['chapter_number'])
    
    logger.info(f"Successfully parsed {len(parsed_chapters)} chapters in correct order")
    return parsed_chapters

def roman_to_int(roman: str) -> int:
    """Convert Roman numeral to integer"""
    roman_numerals = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    result = 0
    prev_value = 0
    
    for char in reversed(roman):
        value = roman_numerals.get(char, 0)
        if value < prev_value:
            result -= value
        else:
            result += value
        prev_value = value
    
    return result

def clean_chapter_title(title: str) -> str:
    """Clean and format chapter title"""
    if not title:
        return "Untitled Chapter"
    
    # Remove common prefixes and clean up
    title = re.sub(r'^[:\-\.\s]+', '', title).strip()
    title = re.sub(r'[:\-\.\s]+$', '', title).strip()
    
    # Remove chapter number if it appears at the start
    title = re.sub(r'^\d+[\.\:\-\s]*', '', title).strip()
    
    if not title:
        return "Untitled Chapter"
    
    return title

def process_chapter_content(content: str, chapter_num: int) -> str:
    """Process chapter content to handle images and formatting"""
    if not content:
        return ""
    
    # Replace image references with standardized placeholders
    image_counter = 1
    
    # Enhanced image detection patterns
    image_patterns = [
        r'(?i)\[image[:\s]*([^\]]*)\]',  # [image: description]
        r'(?i)\[fig[ure]*[:\s]*([^\]]*)\]',  # [figure: description]  
        r'(?i)\[insert\s+image[:\s]*([^\]]*)\]',  # [insert image: description]
        r'(?i)<image[^>]*>([^<]*)</image>',  # <image>description</image>
        r'(?i)\{image[:\s]*([^\}]*)\}',  # {image: description}
        r'(?i)image\s*\d*[:\s]*([^\n]*)',  # image: description
        r'(?i)figure\s*\d*[:\s]*([^\n]*)',  # figure: description
    ]
    
    for pattern in image_patterns:
        def replace_image(match):
            nonlocal image_counter
            caption = match.group(1).strip() if match.group(1) else f"Image {image_counter}"
            # Clean up caption
            caption = re.sub(r'^[:\-\.\s]+', '', caption).strip()
            if not caption:
                caption = f"Chapter {chapter_num} Image {image_counter}"
            
            placeholder = f'[IMAGE:{chapter_num}_{image_counter} caption="{caption}"]'
            image_counter += 1
            return placeholder
        
        content = re.sub(pattern, replace_image, content)
    
    # Clean up extra whitespace and formatting
    content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)  # Multiple newlines to double
    content = re.sub(r'[ \t]+', ' ', content)  # Multiple spaces to single
    content = content.strip()
    
    return content

def count_images_in_content(content: str) -> int:
    """Count image placeholders in content"""
    import re
    pattern = r'\[IMAGE:\d+_\d+[^\]]*\]'
    matches = re.findall(pattern, content)
    return len(matches)

def convert_chapter_to_latex_with_ai(chapter_data: dict) -> str:
    """
    Convert a single chapter content to LaTeX format for template insertion
    Returns formatted content ready to be inserted into {{ chapter_content }} placeholder
    """
    try:
        from groq import Groq
        
        if not GROQ_API_KEY:
            logger.error("Groq API key not configured")
            raise HTTPException(status_code=500, detail="Groq API key not configured")
        
        client = Groq(api_key=GROQ_API_KEY)
        
        chapter_num = chapter_data['chapter_number']
        title = chapter_data['title']
        content = chapter_data['content']
        
        conversion_prompt = f"""
You are a LaTeX content formatter. Your job is to format chapter content that will be inserted into an existing LaTeX template.

TEMPLATE CONTEXT:
The content will be inserted into this template structure:
```
\\section*{{CHAPTER {chapter_num}: {title.upper()}}}
\\setcounter{{figure}}{{0}}
\\vspace{{1cm}}
\\fontsize{{12}}{{18}}\\selectfont\\setstretch{{1.5}}
{{ YOUR_FORMATTED_CONTENT_GOES_HERE }}
```

CHAPTER INFORMATION:
- Chapter Number: {chapter_num}
- Chapter Title: {title}

CONTENT TO FORMAT:
{content}

FORMATTING REQUIREMENTS:

1. **LaTeX Text Formatting**:
   - Use proper LaTeX paragraph breaks (double newlines \\n\\n)
   - Escape special characters: & → \\&, % → \\%, $ → \\$, # → \\#, _ → \\_
   - Use \\textbf{{text}} for bold, \\textit{{text}} for italics
   - Use \\texttt{{text}} for code/monospace
   - Format lists with \\begin{{itemize}}...\\end{{itemize}} or \\begin{{enumerate}}...\\end{{enumerate}}

2. **Image Handling**:
   - Find all [IMAGE:X_Y caption="..."] placeholders
   - Replace with inline LaTeX figures at the EXACT position:
   ```
   \\begin{{figure}}[h]
       \\centering
       \\includegraphics[width=0.8\\textwidth]{{images/chapter{chapter_num}_image[Y].png}}
       \\caption{{[CAPTION_TEXT]}}
       \\label{{fig:chapter{chapter_num}_image[Y]}}
   \\end{{figure}}
   ```
   - LaTeX will automatically number figures as Fig. {chapter_num}.1, {chapter_num}.2, etc.

3. **Content Structure**:
   - Format as professional academic content
   - Maintain logical paragraph flow
   - Insert figures where they make sense contextually
   - Use proper spacing and formatting

4. **Output Requirements**:
   - Return ONLY the formatted content (no section headers, no document structure)
   - Content should be ready to insert into the template's {{ chapter_content }} placeholder
   - No explanations or additional text

EXAMPLE:
Input: "This describes the system. [IMAGE:1_1 caption="System Architecture"] The architecture consists of multiple components."

Output:
This describes the system.

\\begin{{figure}}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{{images/chapter1_image1.png}}
    \\caption{{System Architecture}}
    \\label{{fig:chapter1_image1}}
\\end{{figure}}

The architecture consists of multiple components.

Now format the provided content:
"""

        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an expert LaTeX formatter. Format academic content for insertion into LaTeX templates. Return only formatted LaTeX content, no explanations."},
                {"role": "user", "content": conversion_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=2000,
            timeout=30
        )
        
        latex_content = response.choices[0].message.content.strip()
        logger.info(f"Successfully formatted chapter {chapter_num} content for template ({len(latex_content)} chars)")
        
        return latex_content
        
    except Exception as e:
        logger.error(f"Error formatting chapter {chapter_data.get('chapter_number', '?')} content: {e}")
        # Fallback: basic LaTeX formatting
        content = chapter_data['content']
        
        # Basic escaping
        content = content.replace('&', '\\&')
        content = content.replace('%', '\\%')
        content = content.replace('$', '\\$')
        content = content.replace('#', '\\#')
        content = content.replace('_', '\\_')
        
        # Replace image placeholders with figures
        import re
        image_pattern = r'\[IMAGE:(\d+)_(\d+)\s+caption="([^"]+)"\]'
        
        def replace_image(match):
            chapter_num = match.group(1)
            image_num = match.group(2)
            caption = match.group(3)
            
            return f"""

\\begin{{figure}}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{{images/chapter{chapter_num}_image{image_num}.png}}
    \\caption{{{caption}}}
    \\label{{fig:chapter{chapter_num}_image{image_num}}}
\\end{{figure}}

"""
        
        content = re.sub(image_pattern, replace_image, content)
        
        return content

def generate_complete_latex_document(project_details: ProjectDetails, chapters: List[dict]) -> str:
    """
    Generate complete LaTeX document using existing template with AI-formatted content
    Uses your existing template structure and fills in placeholders intelligently
    """
    try:
        # Load the existing template
        template = load_latex_template()
        
        # Replace project title placeholder in template
        template = template.replace("{{ project_title }}", project_details.title)
        
        # Extract the chapter template section
        chapter_template_start = template.find("% ----------- Chapter Template")
        chapter_template_end = template.find("% ---------------------------------------------------------------")
        
        if chapter_template_start == -1 or chapter_template_end == -1:
            raise HTTPException(status_code=500, detail="Chapter template markers not found in template file")
        
        # Get the header (everything before chapter template)
        header = template[:chapter_template_start].strip()
        
        # Get the footer (everything after chapter template)
        footer_text = template[chapter_template_end + len("% ---------------------------------------------------------------"):].strip()
        
        # Extract the single chapter template
        chapter_template = template[chapter_template_start:chapter_template_end + len("% ---------------------------------------------------------------")]
        
        # Process each chapter and generate LaTeX using the template
        all_chapters_latex = []
        
        for i, chapter_data in enumerate(chapters):
            chapter_num = chapter_data['chapter_number']
            title = chapter_data['title']
            
            logger.info(f"Processing chapter {chapter_num}: {title}")
            
            # Get AI-formatted content for this chapter
            formatted_content = convert_chapter_to_latex_with_ai(chapter_data)
            
            # Use the template and replace placeholders
            chapter_latex = chapter_template
            
            # Replace all template placeholders
            chapter_latex = chapter_latex.replace("{{ chapter_number }}", str(chapter_num))
            chapter_latex = chapter_latex.replace("{{ chapter_title | upper }}", title.upper())
            chapter_latex = chapter_latex.replace("{{ chapter_title }}", title)
            chapter_latex = chapter_latex.replace("{{ chapter_content | safe }}", formatted_content)
            
            # Handle page numbering - only first chapter uses firstcontent style
            if chapter_num == 1:
                # Keep the original template behavior for first chapter
                pass
            else:
                # For subsequent chapters, remove the page counter reset and use projectpages style
                chapter_latex = chapter_latex.replace("\\setcounter{page}{1}", "% Page counter continues")
                chapter_latex = chapter_latex.replace("\\thispagestyle{firstcontent}", "\\thispagestyle{projectpages}")
            
            all_chapters_latex.append(chapter_latex)
        
        # Combine header + all chapters + footer
        complete_latex = header + "\n\n" + "\n".join(all_chapters_latex) + "\n\n" + footer_text
        
        logger.info(f"Generated complete LaTeX document with {len(chapters)} chapters using existing template")
        
        return complete_latex
        
    except Exception as e:
        logger.error(f"Error generating LaTeX document with template: {e}")
        raise HTTPException(status_code=500, detail=f"LaTeX generation failed: {str(e)}")

def process_document_with_ai_preprocessing(content: str, project_details: ProjectDetails) -> str:
    """
    Main preprocessing function that implements the complete AI flow:
    1. Parse .docx into chapters with image placeholders
    2. Use AI to format content for existing LaTeX template
    3. Generate final LaTeX by fitting data into existing template
    """
    try:
        logger.info("Starting AI preprocessing workflow with existing template")
        
        # Step 1: Parse document into chapters
        chapters = parse_docx_into_chapters(content)
        
        if not chapters:
            raise HTTPException(status_code=400, detail="No chapters found in document")
        
        # Step 2-3: Generate LaTeX using existing template with AI-formatted content
        final_latex = fit_chapters_into_existing_template(project_details, chapters)
        
        logger.info("AI preprocessing workflow completed successfully")
        
        return final_latex
        
    except Exception as e:
        logger.error(f"Error in AI preprocessing workflow: {e}")
        raise HTTPException(status_code=500, detail=f"AI preprocessing failed: {str(e)}")

def fit_chapters_into_existing_template(project_details: ProjectDetails, chapters: List[dict]) -> str:
    """
    Take parsed chapters and fit them into the existing LaTeX template
    This is the core function that uses AI to format content for your template
    """
    try:
        # Load your existing template
        template = load_latex_template()
        
        # Replace project title in template
        template = template.replace("{{ project_title }}", project_details.title)
        
        # Create a comprehensive prompt for AI to modify the entire template
        template_modification_prompt = f"""
You are a LaTeX template processor. You have an existing LaTeX template with placeholders, and you need to fill it with actual chapter data.

EXISTING TEMPLATE:
{template}

CHAPTER DATA TO INSERT:
{json.dumps(chapters, indent=2)}

TASK:
1. Take the existing template and replace ALL template placeholders with actual data
2. For each chapter in the data, create a complete chapter section using the template structure
3. Replace placeholders like:
   - {{ chapter_number }} → actual chapter number (1, 2, 3...)
   - {{ chapter_title }} → actual chapter title  
   - {{ chapter_title | upper }} → chapter title in UPPERCASE
   - {{ chapter_content | safe }} → formatted chapter content with figures

4. For [IMAGE:X_Y caption="..."] placeholders in content, replace with:
   \\begin{{figure}}[h]
       \\centering
       \\includegraphics[width=0.8\\textwidth]{{images/chapterX_imageY.png}}
       \\caption{{caption text}}
       \\label{{fig:chapterX_imageY}}
   \\end{{figure}}

5. Handle page numbering:
   - First chapter: use \\setcounter{{page}}{{1}} and \\thispagestyle{{firstcontent}}
   - Subsequent chapters: remove page counter reset, use \\thispagestyle{{projectpages}}

6. Ensure continuous page numbering across all chapters

CRITICAL REQUIREMENTS:
- Keep ALL the original template styling and formatting
- Maintain the header/footer styles exactly as in template
- Replace the chapter template section with actual chapters
- Return COMPLETE, VALID LaTeX document ready to compile
- Do NOT add any explanations or comments outside the LaTeX

Return the complete modified LaTeX document:
"""

        if not GROQ_API_KEY:
            logger.warning("Groq API key not configured, using fallback template processing")
            return generate_complete_latex_document(project_details, chapters)
        
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an expert LaTeX template processor. Modify existing LaTeX templates by replacing placeholders with actual data. Return only valid, complete LaTeX documents."},
                {"role": "user", "content": template_modification_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=4000,
            timeout=45
        )
        
        modified_latex = response.choices[0].message.content.strip()
        
        # Clean up any potential issues
        if not modified_latex.startswith('\\documentclass'):
            # AI might have returned partial content, use fallback
            logger.warning("AI returned incomplete LaTeX, using fallback method")
            return generate_complete_latex_document(project_details, chapters)
        
        logger.info(f"Successfully generated LaTeX document using AI template modification ({len(modified_latex)} chars)")
        
        return modified_latex
        
    except Exception as e:
        logger.error(f"Error in AI template modification: {e}")
        # Fallback to manual template processing
        return generate_complete_latex_document(project_details, chapters)

def process_document_content_with_groq(content: str) -> List[ChapterData]:
    """
    Process document content using new AI preprocessing workflow
    This function maintains backward compatibility with existing API
    """
    try:
        # Parse document into chapters first
        chapters = parse_docx_into_chapters(content)
        
        if not chapters:
            logger.warning("No chapters found, using fallback method")
            return create_fallback_chapters(content)
        
        # Convert parsed chapters to ChapterData format for backward compatibility
        chapter_data_list = []
        for chapter in chapters:
            # Extract images from the content placeholders
            import re
            image_pattern = r'\[IMAGE:(\d+)_(\d+)\s+caption="([^"]+)"\]'
            images = []
            
            for match in re.finditer(image_pattern, chapter['content']):
                chapter_num = int(match.group(1))
                image_num = int(match.group(2))
                caption = match.group(3)
                
                images.append({
                    "filename": f"chapter{chapter_num}_image{image_num}.png",
                    "caption": caption,
                    "image_number": image_num
                })
            
            # Clean content for display (remove image placeholders for backward compatibility)
            clean_content = re.sub(image_pattern, '', chapter['content']).strip()
            
            chapter_data_list.append(ChapterData(
                title=chapter['title'],
                content=clean_content,
                images=images
            ))
        
        logger.info(f"Processed document using new AI preprocessing: {len(chapter_data_list)} chapters")
        return chapter_data_list
        
    except Exception as e:
        logger.error(f"Error in new AI preprocessing: {e}")
        # Fallback to original method for safety
        logger.info("Falling back to original processing method")
        return create_fallback_chapters(content)

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
    """
    Generate LaTeX files using existing template with AI-enhanced content formatting
    """
    try:
        # Convert ChapterData objects to dict format for processing
        chapters_dict = []
        for i, chapter in enumerate(chapters):
            chapter_num = i + 1
            
            # Reconstruct content with image placeholders
            content_with_images = chapter.content
            
            # Add image placeholders back into content
            for img_index, image in enumerate(chapter.images):
                if image.get('filename') and image.get('caption'):
                    placeholder = f'[IMAGE:{chapter_num}_{img_index + 1} caption="{image["caption"]}"]'
                    # Insert at end of content (AI will place them appropriately)
                    content_with_images += f"\n\n{placeholder}"
            
            chapters_dict.append({
                'chapter_number': chapter_num,
                'title': chapter.title,
                'content': content_with_images,
                'image_count': len(chapter.images)
            })
        
        # Generate complete LaTeX using template with AI formatting
        logger.info("Generating LaTeX using existing template with AI content formatting")
        final_latex = generate_complete_latex_document(project_details, chapters_dict)
        
        return {
            "report.tex": final_latex
        }
        
    except Exception as e:
        logger.warning(f"AI template processing failed, falling back to basic template method: {e}")
        
        # Fallback to basic template replacement
        template = load_latex_template()
        
        # Replace project title
        template = template.replace("{{ project_title }}", project_details.title)
        
        # Find template boundaries
        chapter_template_start = template.find("% ----------- Chapter Template")
        chapter_template_end = template.find("% ---------------------------------------------------------------")
        
        if chapter_template_start == -1 or chapter_template_end == -1:
            raise HTTPException(status_code=500, detail="Chapter template markers not found")
        
        # Extract parts
        header = template[:chapter_template_start]
        footer = template[chapter_template_end + len("% ---------------------------------------------------------------"):]
        chapter_template = template[chapter_template_start:chapter_template_end + len("% ---------------------------------------------------------------")]
        
        # Generate chapters using basic template replacement
        all_chapters = []
        
        for i, chapter in enumerate(chapters):
            chapter_num = i + 1
            
            # Basic content with images
            content_with_images = chapter.content
            
            # Add basic figure LaTeX
            for img_index, image in enumerate(chapter.images):
                if image.get('filename') and image.get('caption'):
                    figure_latex = f"""

\\begin{{figure}}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{{images/{image['filename']}}}
    \\caption{{{image['caption']}}}
    \\label{{fig:chapter{chapter_num}_image{img_index + 1}}}
\\end{{figure}}

"""
                    content_with_images += figure_latex
            
            # Replace template placeholders
            chapter_latex = chapter_template
            chapter_latex = chapter_latex.replace("{{ chapter_number }}", str(chapter_num))
            chapter_latex = chapter_latex.replace("{{ chapter_title | upper }}", chapter.title.upper())
            chapter_latex = chapter_latex.replace("{{ chapter_title }}", chapter.title)
            chapter_latex = chapter_latex.replace("{{ chapter_content | safe }}", content_with_images)
            
            all_chapters.append(chapter_latex)
        
        # Combine all parts
        final_latex = header + "\n".join(all_chapters) + footer
        
        return {
            "report.tex": final_latex
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

@app.get("/api/dummy-report-pdf")
async def serve_dummy_pdf():
    """Serve dummy PDF report for preview"""
    try:
        from fastapi.responses import FileResponse
        pdf_path = Path(__file__).parent / "templates" / "dummy_report.pdf"
        
        if not pdf_path.exists():
            raise HTTPException(status_code=404, detail="Dummy PDF not found")
        
        return FileResponse(
            path=str(pdf_path),
            media_type="application/pdf",
            headers={"Content-Disposition": "inline; filename=dummy_report.pdf"}
        )
    except Exception as e:
        logger.error(f"Error serving dummy PDF: {e}")
        raise HTTPException(status_code=500, detail=f"PDF serving failed: {str(e)}")

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
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
