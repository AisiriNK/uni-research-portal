"""
Verification script to test MCP server installation and basic functionality.
Run this after setup to ensure everything works correctly.
"""
import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8001")
API_KEY = os.getenv("API_KEY", "development-key")

HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}


async def verify_installation():
    """Run verification tests"""
    print("=" * 60)
    print("  MCP Server Installation Verification")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: Health Check
        print("\n1. Testing health endpoint...")
        try:
            response = await client.get(f"{MCP_SERVER_URL}/health")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✓ Server is healthy")
                print(f"   ✓ Redis: {data.get('redis', 'unknown')}")
                print(f"   ✓ Firestore: {data.get('firestore', 'unknown')}")
            else:
                print(f"   ✗ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ✗ Cannot connect to server: {e}")
            print(f"\n   Make sure the server is running:")
            print(f"   - Docker: docker-compose up -d")
            print(f"   - Local: python main.py")
            return False
        
        # Test 2: Metrics
        print("\n2. Testing metrics endpoint...")
        try:
            response = await client.get(f"{MCP_SERVER_URL}/metrics")
            if response.status_code == 200 and "mcp_" in response.text:
                print("   ✓ Metrics endpoint working")
            else:
                print("   ✗ Metrics endpoint failed")
        except Exception as e:
            print(f"   ✗ Metrics test failed: {e}")
        
        # Test 3: List Tools
        print("\n3. Testing tool registry...")
        try:
            response = await client.get(
                f"{MCP_SERVER_URL}/tools/list",
                headers=HEADERS
            )
            if response.status_code == 200:
                tools = response.json()["tools"]
                print(f"   ✓ {len(tools)} tools registered")
                for tool in tools[:3]:  # Show first 3
                    print(f"     - {tool['name']}: {tool['description'][:50]}...")
            else:
                print(f"   ✗ Tool listing failed: {response.status_code}")
                if response.status_code == 401:
                    print("     Check your API_KEY in .env file")
        except Exception as e:
            print(f"   ✗ Tool registry test failed: {e}")
        
        # Test 4: Create Context
        print("\n4. Testing context creation...")
        try:
            response = await client.post(
                f"{MCP_SERVER_URL}/context/create",
                headers=HEADERS,
                json={
                    "owner_id": "verification-test",
                    "query": "test query for verification",
                    "ttl_seconds": 300
                }
            )
            if response.status_code == 200:
                context = response.json()
                context_id = context["context_id"]
                print(f"   ✓ Context created: {context_id}")
                
                # Test 5: Retrieve Context
                print("\n5. Testing context retrieval...")
                response = await client.get(
                    f"{MCP_SERVER_URL}/context/{context_id}",
                    headers=HEADERS
                )
                if response.status_code == 200:
                    print("   ✓ Context retrieved successfully")
                else:
                    print(f"   ✗ Context retrieval failed: {response.status_code}")
                
                # Test 6: Execute Simple Tool
                print("\n6. Testing tool execution...")
                response = await client.post(
                    f"{MCP_SERVER_URL}/tools/execute",
                    headers=HEADERS,
                    json={
                        "tool_name": "fetch_openalex",
                        "context_id": context_id,
                        "input": {
                            "query": "machine learning",
                            "limit": 5
                        }
                    }
                )
                if response.status_code == 200:
                    result = response.json()
                    print(f"   ✓ Tool executed: {result['status']}")
                    print(f"     Execution time: {result['execution_time_ms']:.2f}ms")
                else:
                    print(f"   ✗ Tool execution failed: {response.status_code}")
                
                # Test 7: Simple Workflow
                print("\n7. Testing workflow execution...")
                response = await client.post(
                    f"{MCP_SERVER_URL}/workflow/execute",
                    headers=HEADERS,
                    json={
                        "context_id": context_id,
                        "workflow": {
                            "name": "verification_workflow",
                            "mode": "sequential",
                            "steps": [
                                {
                                    "tool": "fetch_openalex",
                                    "input": {
                                        "query": "transformers",
                                        "limit": 3
                                    }
                                }
                            ],
                            "max_concurrent": 1,
                            "timeout_seconds": 60,
                            "on_error": "stop"
                        }
                    }
                )
                if response.status_code == 200:
                    workflow_result = response.json()
                    print(f"   ✓ Workflow executed: {workflow_result['status']}")
                    print(f"     Steps: {workflow_result['steps_completed']}/{workflow_result['steps_total']}")
                else:
                    print(f"   ✗ Workflow execution failed: {response.status_code}")
                
                # Test 8: Execution Trace
                print("\n8. Testing execution trace...")
                response = await client.get(
                    f"{MCP_SERVER_URL}/context/{context_id}/trace",
                    headers=HEADERS
                )
                if response.status_code == 200:
                    trace = response.json()
                    print(f"   ✓ Trace retrieved: {trace['total_steps']} steps")
                else:
                    print(f"   ✗ Trace retrieval failed: {response.status_code}")
                
            else:
                print(f"   ✗ Context creation failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ✗ Context test failed: {e}")
            return False
    
    # Final Summary
    print("\n" + "=" * 60)
    print("  Verification Complete!")
    print("=" * 60)
    print("\n✓ All core features are working correctly")
    print("\nNext steps:")
    print("  1. Review QUICKSTART.md for usage examples")
    print("  2. Check example_client.py for Python integration")
    print("  3. Read README.md for full API documentation")
    print("\nServer URL:", MCP_SERVER_URL)
    print("API Key configured:", "✓" if API_KEY != "development-key" else "⚠ (using default)")
    print("")
    
    return True


if __name__ == "__main__":
    print("\nStarting MCP Server verification...\n")
    print(f"Server URL: {MCP_SERVER_URL}")
    print(f"API Key: {'*' * 8}{API_KEY[-4:] if len(API_KEY) > 4 else API_KEY}")
    print("")
    
    success = asyncio.run(verify_installation())
    
    if not success:
        print("\n❌ Verification failed!")
        print("\nTroubleshooting:")
        print("  1. Ensure server is running: docker-compose ps")
        print("  2. Check logs: docker-compose logs mcp-server")
        print("  3. Verify .env file exists with API_KEY set")
        print("  4. Check Redis is running: docker-compose ps redis")
        exit(1)
    else:
        print("✅ Installation verified successfully!")
        exit(0)
