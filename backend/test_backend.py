import requests
import json

def test_backend():
    files = {
        'file': ('test.txt', 'Chapter 1: Introduction\n\nThis is a test chapter.\n\nChapter 2: Conclusion\n\nThis is the conclusion.', 'text/plain')
    }
    data = {
        'project_title': 'Test Project',
        'guide_name': 'Test Guide', 
        'year': '2024',
        'team_members_json': json.dumps([{'name': 'Test User', 'usn': 'TEST001'}])
    }
    
    try:
        print("Sending request...")
        response = requests.post('http://localhost:8000/api/process-document', files=files, data=data, timeout=60)
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Success: {result.get('success')}")
            print(f"Message: {result.get('message')}")
            print(f"Files: {list(result.get('files', {}).keys())}")
            print(f"First 200 chars of tex file: {list(result.get('files', {}).values())[0][:200]}...")
        else:
            print(f"Error response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_backend()