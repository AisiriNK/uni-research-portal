#!/usr/bin/env python3
"""
Test script for the new AI preprocessing functionality
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

# Test the new helper functions
def test_chapter_parsing():
    """Test the chapter parsing functionality"""
    sample_content = """
CHAPTER 1: Introduction

This is the introduction chapter. It covers the basic concepts and objectives of the project.

[IMAGE:1_1 caption="System Overview Diagram"]

The system architecture consists of multiple components working together.

CHAPTER 2: Literature Review

This chapter discusses the existing work in the field.

[IMAGE:2_1 caption="Comparison Table"]
[IMAGE:2_2 caption="Research Timeline"]

Various approaches have been studied and analyzed.

CHAPTER 3: Methodology

The methodology chapter describes the approach taken in this research.

This includes data collection and analysis techniques.
"""

    try:
        from app import parse_docx_into_chapters
        
        chapters = parse_docx_into_chapters(sample_content)
        
        print("✓ Chapter parsing test completed")
        print(f"  Found {len(chapters)} chapters:")
        
        for chapter in chapters:
            print(f"  - Chapter {chapter['chapter_number']}: {chapter['title']}")
            print(f"    Content length: {len(chapter['content'])} chars")
            print(f"    Images: {chapter['image_count']}")
        
        return True
        
    except Exception as e:
        print(f"✗ Chapter parsing test failed: {e}")
        return False

def test_template_integration():
    """Test the template integration with sample data"""
    try:
        from app import ProjectDetails, TeamMember, fit_chapters_into_existing_template
        
        # Sample project details
        project_details = ProjectDetails(
            title="AI-Based Document Processing System",
            guide="Dr. John Smith",
            year="2024",
            team_members=[
                TeamMember(name="Alice Johnson", usn="1BM18CS001"),
                TeamMember(name="Bob Wilson", usn="1BM18CS002")
            ]
        )
        
        # Sample chapters
        sample_chapters = [
            {
                'chapter_number': 1,
                'title': 'Introduction',
                'content': 'This chapter introduces the project. [IMAGE:1_1 caption="System Architecture"] The system is designed for efficiency.',
                'image_count': 1
            },
            {
                'chapter_number': 2,
                'title': 'Methodology',
                'content': 'This chapter describes the methodology used. The approach is systematic and thorough.',
                'image_count': 0
            }
        ]
        
        # Test template integration (without AI if no API key)
        result = fit_chapters_into_existing_template(project_details, sample_chapters)
        
        # Basic validation
        if "\\documentclass" in result and "\\end{document}" in result:
            print("✓ Template integration test passed")
            print(f"  Generated LaTeX document: {len(result)} characters")
            return True
        else:
            print("✗ Template integration test failed: Invalid LaTeX structure")
            return False
        
    except Exception as e:
        print(f"✗ Template integration test failed: {e}")
        return False

def test_latex_structure():
    """Test the LaTeX document structure"""
    try:
        from app import load_latex_template
        
        template = load_latex_template()
        
        # Check if template has required sections
        required_sections = [
            "% ----------- Chapter Template",
            "{{ project_title }}",
            "\\begin{document}",
            "\\end{document}"
        ]
        
        missing_sections = []
        for section in required_sections:
            if section not in template:
                missing_sections.append(section)
        
        if missing_sections:
            print(f"✗ LaTeX template test failed: Missing sections: {missing_sections}")
            return False
        
        print("✓ LaTeX template structure test passed")
        return True
        
    except Exception as e:
        print(f"✗ LaTeX template test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("Testing AI preprocessing functionality...\n")
    
    tests = [
        ("Chapter Parsing", test_chapter_parsing),
        ("LaTeX Structure", test_latex_structure),
        ("Template Integration", test_template_integration),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"Running {test_name} test...")
        if test_func():
            passed += 1
        print()
    
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! AI preprocessing is ready to use.")
    else:
        print("⚠️  Some tests failed. Please check the implementation.")

if __name__ == "__main__":
    main()