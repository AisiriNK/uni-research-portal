"""
Test script for Research Hub Backend API
"""

import asyncio
import httpx
import json
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000"

async def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BASE_URL}/api/health")
            print(f"✅ Health check: {response.status_code}")
            print(f"   Response: {response.json()}")
            return True
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            return False

async def test_search_papers():
    """Test the paper search endpoint"""
    print("\n🔍 Testing paper search...")
    async with httpx.AsyncClient() as client:
        try:
            params = {
                "query": "machine learning",
                "limit": 5,
                "year_from": 2020,
                "year_to": 2024
            }
            response = await client.get(f"{BASE_URL}/api/papers/search", params=params)
            print(f"✅ Paper search: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Found {data['count']} papers")
                if data['papers']:
                    first_paper = data['papers'][0]
                    print(f"   First paper: {first_paper['title'][:60]}...")
            return True
        except Exception as e:
            print(f"❌ Paper search failed: {e}")
            return False

async def test_search_and_cluster():
    """Test the main search and cluster endpoint"""
    print("\n🔍 Testing search and cluster...")
    async with httpx.AsyncClient() as client:
        try:
            payload = {
                "query": "artificial intelligence",
                "limit": 10,
                "year_from": 2020,
                "year_to": 2024
            }
            response = await client.post(
                f"{BASE_URL}/api/search-and-cluster", 
                json=payload,
                timeout=60.0
            )
            print(f"✅ Search and cluster: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Generated {len(data['nodes'])} nodes and {len(data['edges'])} edges")
                
                # Show cluster structure
                for node in data['nodes']:
                    print(f"   Node: {node['label']} (Level {node['level']}) - {node['paper_count']} papers")
            
            return True
        except Exception as e:
            print(f"❌ Search and cluster failed: {e}")
            return False

async def test_openalex_integration():
    """Test OpenAlex API integration directly"""
    print("\n🔍 Testing OpenAlex integration...")
    async with httpx.AsyncClient() as client:
        try:
            url = "https://api.openalex.org/works"
            params = {
                "search": "machine learning",
                "per-page": 3,
                "sort": "cited_by_count:desc"
            }
            response = await client.get(url, params=params, timeout=30.0)
            print(f"✅ OpenAlex direct: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   OpenAlex returned {len(data['results'])} papers")
                if data['results']:
                    first_paper = data['results'][0]
                    print(f"   Sample paper: {first_paper.get('title', 'No title')[:60]}...")
            
            return True
        except Exception as e:
            print(f"❌ OpenAlex integration failed: {e}")
            return False

async def run_all_tests():
    """Run all tests"""
    print("🚀 Starting Research Hub Backend Tests\n")
    
    # Test OpenAlex first
    await test_openalex_integration()
    
    # Test backend endpoints
    health_ok = await test_health_check()
    
    if health_ok:
        await test_search_papers()
        await test_search_and_cluster()
    else:
        print("❌ Backend is not running. Please start the server first:")
        print("   cd backend")
        print("   python app.py")
    
    print("\n✅ Test suite completed!")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
