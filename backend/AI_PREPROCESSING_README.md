# AI-Powered LaTeX Preprocessing Documentation

## Overview

This document describes the new AI-powered preprocessing system that has been added to the Research Hub backend. The system implements a sophisticated flow for generating LaTeX reports from document content using AI assistance.

## Flow Description

The new preprocessing workflow follows these steps:

### 1. Document Parsing
- **Function**: `parse_docx_into_chapters(content: str)`
- **Purpose**: Parse document content into chapters using regex pattern matching
- **Pattern**: Uses `CHAPTER *` regex to identify chapter boundaries
- **Image Handling**: Replaces image references with standardized placeholders

**Image Placeholder Format**:
```
[IMAGE:chapterNum_imageNum caption="Description here"]
```

### 2. AI-Powered Template Integration
- **Function**: `fit_chapters_into_existing_template(project_details, chapters)`
- **Purpose**: Use AI to intelligently fit parsed chapter data into your existing LaTeX template
- **Features**:
  - Works with your existing report_template.tex
  - Replaces template placeholders ({{ chapter_title }}, {{ chapter_content }}, etc.)
  - AI formats content for LaTeX compatibility
  - Maintains your template's styling and structure

### 3. Smart Content Formatting
- **Function**: `convert_chapter_to_latex_with_ai(chapter_data: dict)`
- **Purpose**: Format chapter content specifically for your template's {{ chapter_content }} placeholder
- **Features**:
  - Proper LaTeX escaping of special characters
  - Inline figure placement at correct positions
  - Uses your template's figure formatting
  - Professional academic formatting that fits your template

## Key Features

### ✅ Intelligent Chapter Detection
- Automatically detects chapter boundaries using regex
- Handles various chapter naming conventions
- Extracts meaningful chapter titles

### ✅ Smart Image Processing
- Detects image references in multiple formats
- Creates standardized placeholders
- Maintains proper figure numbering per chapter
- Places figures inline at correct positions

### ✅ AI-Enhanced LaTeX Generation
- Uses Groq AI for intelligent content conversion
- Proper LaTeX formatting and escaping
- Academic document structure
- Professional typography

### ✅ Continuous Page Numbering
- Pages continue across chapters without resetting
- Proper header/footer styles for different page types
- Professional document flow

### ✅ Backward Compatibility
- Existing API routes remain unchanged
- Fallback to original method if AI processing fails
- No breaking changes to existing functionality

## Implementation Details

### Main Entry Points
```python
def process_document_with_ai_preprocessing(content: str, project_details: ProjectDetails) -> str
```
Main orchestrator that coordinates the entire AI preprocessing workflow.

```python
def fit_chapters_into_existing_template(project_details: ProjectDetails, chapters: List[dict]) -> str
```
Core function that uses AI to fit parsed chapter data into your existing LaTeX template.

### Integration Points
The new system integrates seamlessly with existing functions:
- `process_document_content_with_groq()` - Uses new parsing but maintains API compatibility
- `generate_latex_files()` - Enhanced to use AI template integration
- All existing API endpoints work without modification
- Your existing report_template.tex is used as-is

### Error Handling
- Comprehensive error handling with fallbacks
- Graceful degradation if AI services are unavailable
- Detailed logging for debugging

## Usage

The system works automatically when documents are processed through existing API endpoints:

1. **POST /api/process-document** - Uses new AI preprocessing
2. **POST /api/download-latex-project** - Generates ZIP with AI-enhanced LaTeX

No changes required to frontend or API calls.

## Benefits

1. **Higher Quality Output**: AI generates more professional LaTeX formatting
2. **Better Figure Placement**: Images appear inline at appropriate positions
3. **Smarter Chapter Detection**: More accurate chapter boundary detection
4. **Consistent Formatting**: Professional academic document structure
5. **Continuous Pagination**: Proper page numbering across entire document

## Technical Requirements

- **Groq API Key**: Required for AI processing (set GROQ_API_KEY environment variable)
- **Python Packages**: groq, python-docx, fastapi (see requirements.txt)
- **LaTeX Template**: Compatible with existing report_template.tex

## Error Handling & Fallbacks

The system includes multiple levels of fallback:

1. **Primary**: AI-powered preprocessing with Groq
2. **Secondary**: Basic regex-based processing
3. **Tertiary**: Original template-based method

This ensures the system always produces output even if AI services are unavailable.

## Testing

Run the test suite to verify functionality:

```bash
python test_ai_preprocessing.py
```

## Configuration

Set environment variables:
```bash
GROQ_API_KEY=your_groq_api_key_here
```

## Future Enhancements

Potential improvements for future versions:
- Support for more document formats (.pdf, .html)
- Enhanced image detection algorithms
- Custom LaTeX templates per document type
- Batch processing capabilities
- Integration with more AI providers

## Troubleshooting

### Common Issues

1. **Missing GROQ_API_KEY**: System will fall back to basic processing
2. **Chapter Detection Issues**: Verify document uses "CHAPTER" headings
3. **Image Placeholder Problems**: Check image reference format in source document
4. **LaTeX Compilation Errors**: Ensure all referenced image files exist

### Debug Logging

Enable debug logging to see detailed processing information:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

*This documentation describes the AI preprocessing system added to the Research Hub backend while maintaining full backward compatibility with existing functionality.*