# MCP Integration Guide for Research Hub

This document explains how the MCP (Model Context Protocol) server is integrated with the existing Research Hub services.

## Overview

The MCP server acts as an **orchestration layer** that coordinates multiple AI agents (Groq, Gemini, OpenAlex, clustering) through a unified workflow engine. This eliminates redundant API calls and provides shared context memory across all operations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Research Hub Frontend                     │
│  (React + TypeScript)                                        │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ ResearchHub    │  │ PaperCluster   │  │ ResearchGap   │ │
│  │ Component      │  │ Component      │  │ Component     │ │
│  └────────┬───────┘  └────────┬───────┘  └───────┬───────┘ │
│           │                   │                   │          │
│           └───────────────────┼───────────────────┘          │
│                               │                              │
└───────────────────────────────┼──────────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   mcpService.ts        │
                    │  (MCP Client Wrapper)  │
                    └───────────┬────────────┘
                                │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐    ┌───────▼────────┐    ┌───────▼────────┐
│ Backend API    │    │  MCP Server    │    │  Direct APIs   │
│ (app.py)       │    │  (main.py)     │    │  (OpenAlex,    │
│                │    │                │    │   Groq, etc)   │
│ Port 8000      │    │  Port 8001     │    │                │
└───────┬────────┘    └───────┬────────┘    └────────────────┘
        │                      │
        │              ┌───────▼────────┐
        │              │  Redis Store   │
        │              │  (Context DB)  │
        │              └────────────────┘
        │
        └──────────────────────────────────────┐
                                               │
                                    ┌──────────▼──────────┐
                                    │  OpenAlex API       │
                                    │  Groq API           │
                                    │  Gemini API         │
                                    └─────────────────────┘
```

## Integration Points

### 1. Frontend Integration (`src/services/mcpService.ts`)

The MCP service provides high-level orchestration functions:

#### **Complete Research Analysis**
```typescript
import { orchestrateResearchAnalysis } from '@/services/mcpService';

const { contextId, result, data } = await orchestrateResearchAnalysis(
  userId,
  'transformers in NLP',
  { limit: 50 }
);

console.log('Papers:', data.papers);
console.log('Clusters:', data.clusters);
console.log('Execution time:', result.execution_time_ms);
```

#### **Cluster Summarization**
```typescript
import { orchestrateClusterSummarization } from '@/services/mcpService';

const result = await orchestrateClusterSummarization(
  userId,
  'machine learning',
  clusters  // Your existing clusters
);
```

#### **Research Gap Analysis**
```typescript
import { orchestrateGapAnalysis } from '@/services/mcpService';

const { gaps, contextId } = await orchestrateGapAnalysis(
  userId,
  basePaper,
  relatedPapers,
  'Computer Science'
);
```

#### **Pre-defined Workflows**
```typescript
import { mcpClient, RESEARCH_WORKFLOWS } from '@/services/mcpService';

// Create context
const context = await mcpClient.createContext(userId, query);

// Execute pre-defined workflow
const result = await mcpClient.executeWorkflow(
  context.context_id,
  RESEARCH_WORKFLOWS.FULL_ANALYSIS(query, 50)
);
```

### 2. Backend Integration (`backend/mcp_integration.py`)

The backend can orchestrate MCP workflows on behalf of the frontend:

#### **Orchestrated Clustering**
```python
from mcp_integration import orchestrate_paper_clustering

result = await orchestrate_paper_clustering(
    query="machine learning",
    limit=50,
    num_clusters=5,
    owner_id="user123"
)

# Returns: context_id, workflow_result, papers, clusters
```

#### **API Endpoints**
```bash
# Orchestrate clustering via backend
POST /api/mcp/orchestrate-clustering
  ?query=machine%20learning
  &limit=50
  &num_clusters=5

# Orchestrate gap analysis
POST /api/mcp/orchestrate-gaps
Body: { "base_paper": {...}, "related_papers": [...] }

# Get cached context
GET /api/mcp/context/{context_id}
```

### 3. MCP Server Tools (Real Implementations)

The MCP server now uses **real API calls** instead of mocks:

#### **Groq Classification**
- Uses `groq-sdk` for paper classification
- Batches requests to avoid rate limits
- Falls back to mock if API key missing

#### **Gemini Summarization**
- Uses `google-generativeai` for cluster summaries
- Parses JSON responses for structured output
- Handles token limits by limiting abstracts

#### **OpenAlex Fetch**
- Direct integration with OpenAlex API
- Reconstructs abstracts from inverted index
- Parses authors, concepts, citations

## Environment Configuration

### Frontend (`.env`)
```bash
# MCP Server
VITE_MCP_SERVER_URL=http://localhost:8001
VITE_MCP_API_KEY=your-mcp-api-key

# Direct AI APIs (optional, for non-MCP calls)
VITE_GROQ_API_KEY=your-groq-key
VITE_GEMINI_API_KEY=your-gemini-key
```

### Backend (`backend/.env`)
```bash
# MCP Integration
MCP_SERVER_URL=http://localhost:8001
MCP_API_KEY=your-mcp-api-key

# Direct APIs
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
```

### MCP Server (`mcp-server/.env`)
```bash
# Redis
REDIS_URL=redis://localhost:6379/0

# API Keys
API_KEY=your-mcp-api-key
ADMIN_API_KEY=your-admin-key

# External AI Services
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
OLLAMA_BASE_URL=http://localhost:11434
OPENALEX_EMAIL=your-email@example.com
```

## Usage Patterns

### Pattern 1: Direct MCP Orchestration (Frontend → MCP)

**When to use:** Frontend needs complete control over workflow

```typescript
// Component code
const handleResearch = async () => {
  const context = await mcpClient.createContext(user.uid, searchQuery);
  
  const workflow = {
    name: 'custom_research',
    mode: 'sequential',
    steps: [
      { tool: 'fetch_openalex', input: { query: searchQuery, limit: 30 } },
      { tool: 'cluster_papers', input: { num_clusters: 5 } },
    ],
    timeout_seconds: 300,
    on_error: 'stop'
  };
  
  const result = await mcpClient.executeWorkflow(context.context_id, workflow);
  const data = await mcpClient.getContext(context.context_id);
  
  setPapers(data.papers);
  setClusters(data.clusters);
};
```

### Pattern 2: Backend-Mediated MCP (Frontend → Backend → MCP)

**When to use:** Backend needs to add custom logic or combine with other services

```typescript
// Frontend
const response = await fetch('/api/mcp/orchestrate-clustering', {
  method: 'POST',
  body: JSON.stringify({ query: searchQuery, limit: 50 })
});

const { context_id, papers, clusters } = await response.json();
```

### Pattern 3: Hybrid (Use existing services + MCP caching)

**When to use:** Gradually migrate to MCP while keeping existing code

```typescript
// Use existing OpenAlex service
import { searchPapers } from '@/services/openAlexService';
const papers = await searchPapers(query, 50);

// Then use MCP for orchestration of AI services
const { gaps } = await orchestrateGapAnalysis(userId, basePaper, papers);
```

## Migration Strategy

### Phase 1: Parallel Operation ✅ CURRENT
- MCP server running alongside existing services
- Both old and new code paths available
- Can switch between implementations with feature flag

### Phase 2: Gradual Migration (Recommended)
1. **Start with Research Gap Analysis** (most complex)
   - Replace `researchGapService.ts` calls with `orchestrateGapAnalysis`
   - Benefits: Shared context, no redundant paper fetching

2. **Then Paper Clustering**
   - Replace `paperClusteringService.ts` with MCP orchestration
   - Benefits: Better caching, parallel processing

3. **Finally Complete Workflows**
   - Use MCP for entire research pipelines
   - Benefits: Single context, complete traceability

### Phase 3: Full MCP (Future)
- All AI orchestration through MCP
- Remove direct AI service calls from frontend
- Backend becomes thin API layer

## Performance Comparison

### Without MCP (Current)
```
User searches "transformers" →
  1. Fetch 50 papers from OpenAlex (3s)
  2. Frontend calls Groq for gaps (5s per paper, sequential)
  3. Frontend calls Gemini for summaries (3s per cluster)
  Total: 3s + (50 × 5s) + (5 × 3s) = 268s
```

### With MCP (Optimized)
```
User searches "transformers" →
  MCP Workflow:
    1. Fetch 50 papers (cached in context) (3s)
    2. Parallel Groq classification (5s total)
    3. Parallel Gemini summaries (3s total)
  Total: 11s (24x faster!)
```

## Caching Benefits

### Shared Context Memory
```typescript
// First request: Full analysis
const { contextId } = await orchestrateResearchAnalysis(userId, 'AI');
// Fetches papers, generates embeddings, clusters, classifies

// Later: Get gaps without re-fetching
const context = await mcpClient.getContext(contextId);
// Papers, embeddings, clusters already available!
// Just run gap analysis on existing data
```

### TTL-based Expiration
- Contexts expire after TTL (default 3600s = 1 hour)
- Redis automatically cleans up old data
- Optional Firestore persistence for long-term storage

## Monitoring & Debugging

### Execution Traces
```typescript
const trace = await mcpClient.getExecutionTrace(contextId);

console.log('Total steps:', trace.total_steps);
console.log('Execution time:', trace.total_execution_time_ms);

trace.agent_logs.forEach(log => {
  console.log(`${log.agent} (${log.step}): ${log.status}`);
  console.log(`  Time: ${log.execution_time_ms}ms`);
  if (log.error_message) {
    console.log(`  Error: ${log.error_message}`);
  }
});
```

### Health Checks
```typescript
// Check if MCP is available
const isAvailable = await checkMCPAvailability();

if (!isAvailable) {
  // Fall back to direct API calls
  console.warn('MCP server unavailable, using direct APIs');
}
```

### Metrics
```bash
# Prometheus metrics
curl http://localhost:8001/metrics

# Key metrics:
# - mcp_workflow_executed_total
# - mcp_tool_executed_total{tool_name="fetch_openalex"}
# - mcp_request_duration_seconds
```

## Error Handling

### Circuit Breaker
MCP tools have built-in circuit breaker:
- After 5 failures, circuit opens
- Tool becomes unavailable for 60s
- Prevents cascading failures

### Retry Logic
- Tools retry up to 3 times
- Exponential backoff (1s, 2s, 4s)
- Configurable per tool

### Graceful Degradation
```typescript
try {
  const result = await orchestrateResearchAnalysis(userId, query);
  // Use MCP results
} catch (error) {
  console.warn('MCP failed, falling back to direct APIs');
  
  // Fallback to existing services
  const papers = await searchPapers(query, 50);
  const gaps = await findResearchGaps(papers[0]);
}
```

## Best Practices

### 1. Use Pre-defined Workflows
```typescript
// Good: Use tested workflow
const workflow = RESEARCH_WORKFLOWS.FULL_ANALYSIS(query, 50);

// Avoid: Custom workflows unless necessary
const workflow = { /* custom config */ };
```

### 2. Check MCP Availability First
```typescript
const mcpAvailable = await checkMCPAvailability();

if (mcpAvailable) {
  // Use MCP orchestration
} else {
  // Use direct APIs
}
```

### 3. Cache Context IDs
```typescript
// Store context ID in component state or localStorage
localStorage.setItem(`research_${query}`, contextId);

// Later, retrieve cached results
const cachedContextId = localStorage.getItem(`research_${query}`);
if (cachedContextId) {
  const data = await getCachedAnalysis(cachedContextId);
}
```

### 4. Handle Async Workflows
```typescript
// For long workflows, poll status
const result = await mcpClient.executeWorkflow(contextId, workflow);

if (result.status === 'running') {
  // Poll for completion
  const checkStatus = setInterval(async () => {
    const status = await mcpClient.getWorkflowStatus(contextId);
    if (status.status !== 'active') {
      clearInterval(checkStatus);
      // Workflow completed
    }
  }, 2000);
}
```

## Testing

### Unit Tests
```bash
cd mcp-server
pytest tests/test_main.py -v
```

### Integration Tests
```bash
# Start services
docker-compose up -d

# Run tests
pytest tests/test_integration.py -v -m integration
```

### End-to-End Test
```typescript
// In your frontend test
import { orchestrateResearchAnalysis } from '@/services/mcpService';

test('MCP orchestration returns papers and clusters', async () => {
  const result = await orchestrateResearchAnalysis(
    'test-user',
    'machine learning',
    { limit: 10 }
  );
  
  expect(result.data.papers.length).toBeGreaterThan(0);
  expect(result.data.clusters.length).toBeGreaterThan(0);
  expect(result.result.status).toBe('completed');
});
```

## Troubleshooting

### Issue: MCP server not starting
**Solution:**
```bash
# Check Redis
docker-compose ps redis

# Check logs
docker-compose logs mcp-server

# Verify .env file
cat mcp-server/.env
```

### Issue: API key errors
**Solution:**
```bash
# Frontend
echo $VITE_MCP_API_KEY

# Backend
echo $MCP_API_KEY

# MCP Server
echo $API_KEY

# Make sure they match!
```

### Issue: Context not found
**Reason:** Context expired (TTL exceeded)

**Solution:** Increase TTL or use Firestore persistence
```typescript
await mcpClient.createContext(userId, query, 7200); // 2 hours
```

## Next Steps

1. **Start MCP Server**
   ```bash
   cd mcp-server
   docker-compose up -d
   ```

2. **Update Environment Variables**
   - Add MCP configuration to `.env` files
   - Set API keys for Groq, Gemini

3. **Test Integration**
   ```bash
   python mcp-server/verify_installation.py
   ```

4. **Migrate One Component**
   - Start with `ResearchGapAnalysis.tsx`
   - Replace service calls with MCP orchestration
   - Test thoroughly

5. **Monitor Performance**
   - Check execution times
   - Review traces
   - Optimize workflows

---

For questions or issues, refer to:
- `mcp-server/README.md` - Complete MCP documentation
- `mcp-server/QUICKSTART.md` - 5-minute setup guide
- `mcp-server/IMPLEMENTATION_SUMMARY.md` - Technical details
