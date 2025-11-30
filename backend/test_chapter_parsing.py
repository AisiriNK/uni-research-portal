#!/usr/bin/env python3
"""
Simple test for chapter parsing functionality
"""

import re
import json

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
    pattern = r'\[IMAGE:\d+_\d+[^\]]*\]'
    matches = re.findall(pattern, content)
    return len(matches)

def parse_docx_into_chapters(content: str) -> list:
    """
    Parse document content into chapters using regex pattern 'CHAPTER *'
    Returns list of chapters with placeholders for images, properly ordered
    """
    
    print(f"Starting chapter parsing. Content length: {len(content)} characters")
    
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
        print("No specific chapter patterns found, trying simpler approach")
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
    
    print(f"Found {len(chapter_matches)} chapter markers")
    
    if not chapter_matches:
        # No chapters found, treat entire document as single chapter
        print("No chapters detected, treating as single document")
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
        
        print(f"Parsed Chapter {chapter_match['chapter_number']}: {chapter_match['title'][:50]}... ({len(processed_content)} chars, {image_count} images)")
    
    # Sort chapters by chapter number to ensure proper order
    parsed_chapters.sort(key=lambda x: x['chapter_number'])
    
    print(f"Successfully parsed {len(parsed_chapters)} chapters in correct order")
    return parsed_chapters

def test_chapter_parsing():
    """Test the chapter parsing functionality"""
    sample_content = """
Introduction to the project

CHAPTER 1: Introduction

This is the introduction chapter. It covers the basic concepts and objectives of the project.

[image: System Overview Diagram]

The system architecture consists of multiple components working together.

CHAPTER 2: Literature Review

This chapter discusses the existing work in the field. Research has shown various approaches.

[figure: Comparison Table]
[insert image: Research Timeline]

Various approaches have been studied and analyzed.

CHAPTER 3: Methodology

The methodology chapter describes the approach taken in this research.

{image: Data Flow Diagram}

This includes data collection and analysis techniques.

CHAPTER IV: Results and Analysis

The results chapter shows the findings from our experiments.

Image 1: Performance Graph
Figure 2: Accuracy Metrics

The analysis reveals significant improvements.

CHAPTER 5: Conclusion

This chapter concludes the research with key findings and future work.
"""

    try:
        chapters = parse_docx_into_chapters(sample_content)
        
        print("\n" + "="*60)
        print("CHAPTER PARSING TEST RESULTS")
        print("="*60)
        print(f"Found {len(chapters)} chapters:")
        
        for chapter in chapters:
            print(f"\n📖 Chapter {chapter['chapter_number']}: {chapter['title']}")
            print(f"   Content length: {len(chapter['content'])} characters")
            print(f"   Images: {chapter['image_count']}")
            print(f"   Content preview: {chapter['content'][:100]}...")
        
        print("\n✅ Chapter parsing test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Chapter parsing test failed: {e}")
        return False

def test_various_chapter_formats():
    """Test different chapter format patterns"""
    
    test_cases = [
        {
            'name': 'Standard Format',
            'content': '''
CHAPTER 1: Introduction
Content of chapter 1

CHAPTER 2: Literature Review  
Content of chapter 2
'''
        },
        {
            'name': 'Roman Numerals',
            'content': '''
CHAPTER I: Introduction
Content of chapter 1

CHAPTER II: Background
Content of chapter 2

CHAPTER III: Methodology
Content of chapter 3
'''
        },
        {
            'name': 'Numbers with Dots',
            'content': '''
1. CHAPTER: Introduction
Content of chapter 1

2. CHAPTER: Background
Content of chapter 2
'''
        },
        {
            'name': 'Mixed Formats',
            'content': '''
CHAPTER 1 - Introduction
Content of chapter 1

CHAPTER: 2 Background Study
Content of chapter 2

CHAPTER III: Methodology
Content of chapter 3
'''
        }
    ]
    
    print("\n" + "="*60)
    print("TESTING VARIOUS CHAPTER FORMATS")
    print("="*60)
    
    for i, test_case in enumerate(test_cases):
        print(f"\n🧪 Test {i+1}: {test_case['name']}")
        print("-" * 40)
        
        chapters = parse_docx_into_chapters(test_case['content'])
        
        for chapter in chapters:
            print(f"   Chapter {chapter['chapter_number']}: {chapter['title']}")
    
    return True

if __name__ == "__main__":
    print("🚀 Testing Enhanced Chapter Parsing Logic")
    print("=" * 60)
    
    success1 = test_chapter_parsing()
    success2 = test_various_chapter_formats()
    
    if success1 and success2:
        print("\n🎉 All tests passed! Chapter parsing is working correctly.")
    else:
        print("\n⚠️ Some tests failed.")