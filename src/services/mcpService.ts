/**
 * MCP (Model Context Protocol) Service Integration
 * Orchestrates multi-agent AI workflows using the MCP server
 */

// MCP Server Configuration
const MCP_SERVER_URL = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:8001';
const MCP_API_KEY = import.meta.env.VITE_MCP_API_KEY || 'development-key';

// Types for MCP integration
export interface MCPContext {
  context_id: string;
  owner_id: string;
  query: string;
  created_at: string;
  ttl: number;
  status: string;
}

export interface MCPWorkflowStep {
  tool: string;
  input: Record<string, any>;
  depends_on?: string[];
}

export interface MCPWorkflow {
  name: string;
  mode: 'sequential' | 'parallel' | 'dag';
  steps: MCPWorkflowStep[];
  max_concurrent?: number;
  timeout_seconds?: number;
  on_error?: 'stop' | 'continue' | 'retry';
}

export interface MCPWorkflowResult {
  execution_id: string;
  context_id: string;
  workflow_name: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  steps_completed: number;
  steps_total: number;
  steps_failed: number;
  started_at: string;
  completed_at?: string;
  execution_time_ms: number;
  results: MCPToolResult[];
}

export interface MCPToolResult {
  execution_id: string;
  tool_name: string;
  context_id: string;
  status: 'success' | 'error' | 'timeout';
  output?: Record<string, any>;
  error?: string;
  execution_time_ms: number;
}

export interface MCPContextData {
  context_id: string;
  owner_id: string;
  query: string;
  created_at: string;
  last_updated: string;
  status: string;
  papers: any[];
  papers_total: number;
  papers_page: number;
  papers_per_page: number;
  clusters: any[];
  agent_logs: MCPAgentLog[];
  embeddings_count: number;
  citation_metrics_count: number;
  metadata: Record<string, any>;
}

export interface MCPAgentLog {
  log_id: string;
  agent: string;
  step: string;
  input_summary: string;
  output_summary: string;
  status: 'success' | 'error' | 'timeout';
  error_message?: string;
  execution_time_ms: number;
  timestamp: string;
}

/**
 * MCP Client for orchestrating AI workflows
 */
class MCPClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = MCP_SERVER_URL, apiKey: string = MCP_API_KEY) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Create a new research context
   */
  async createContext(
    ownerId: string,
    query: string,
    ttlSeconds: number = 3600,
    metadata?: Record<string, any>
  ): Promise<MCPContext> {
    return this.request<MCPContext>('/context/create', {
      method: 'POST',
      body: JSON.stringify({
        owner_id: ownerId,
        query,
        ttl_seconds: ttlSeconds,
        metadata: metadata || {},
      }),
    });
  }

  /**
   * Get context data with results
   */
  async getContext(
    contextId: string,
    page: number = 1,
    perPage: number = 50
  ): Promise<MCPContextData> {
    return this.request<MCPContextData>(
      `/context/${contextId}?page=${page}&per_page=${perPage}`
    );
  }

  /**
   * Update context with new data
   */
  async updateContext(
    contextId: string,
    updates: Partial<MCPContextData>
  ): Promise<{ message: string; context_id: string }> {
    return this.request(`/context/${contextId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    contextId: string,
    workflow: MCPWorkflow
  ): Promise<MCPWorkflowResult> {
    return this.request<MCPWorkflowResult>('/workflow/execute', {
      method: 'POST',
      body: JSON.stringify({
        context_id: contextId,
        workflow,
      }),
    });
  }

  /**
   * Get workflow execution status
   */
  async getWorkflowStatus(contextId: string): Promise<{
    context_id: string;
    status: string;
    total_steps: number;
    successful_steps: number;
    failed_steps: number;
    last_updated: string;
    recent_logs: any[];
  }> {
    return this.request(`/workflow/status/${contextId}`);
  }

  /**
   * Get execution trace
   */
  async getExecutionTrace(contextId: string): Promise<{
    context_id: string;
    owner_id: string;
    query: string;
    agent_logs: MCPAgentLog[];
    total_steps: number;
    total_execution_time_ms: number;
    status: string;
    created_at: string;
    last_updated: string;
  }> {
    return this.request(`/context/${contextId}/trace`);
  }

  /**
   * Check server health
   */
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    redis: string;
    firestore: string;
  }> {
    return this.request('/health');
  }
}

// Export singleton instance
export const mcpClient = new MCPClient();

/**
 * Pre-defined workflows for common research tasks
 */
export const RESEARCH_WORKFLOWS = {
  /**
   * Complete research analysis pipeline (sequential)
   */
  FULL_ANALYSIS: (query: string, limit: number = 50): MCPWorkflow => ({
    name: 'complete_research_analysis',
    mode: 'sequential',
    steps: [
      {
        tool: 'fetch_openalex',
        input: { query, limit },
      },
      {
        tool: 'embed_papers',
        input: { paper_ids: [], model: 'text-embedding-ada-002' },
      },
      {
        tool: 'cluster_papers',
        input: { embedding_ids: [], num_clusters: 5 },
      },
      {
        tool: 'classify_with_groq',
        input: { paper_ids: [], categories: ['NLP', 'CV', 'ML', 'Robotics', 'Theory'] },
      },
      {
        tool: 'compute_citation_intel',
        input: { paper_ids: [], citation_data: [] },
      },
    ],
    timeout_seconds: 600,
    on_error: 'continue',
  }),

  /**
   * Fast cluster-based analysis (parallel)
   */
  CLUSTER_ANALYSIS: (numClusters: number = 5): MCPWorkflow => ({
    name: 'parallel_cluster_analysis',
    mode: 'parallel',
    steps: Array.from({ length: numClusters }, (_, i) => ({
      tool: 'summarize_with_gemini',
      input: {
        cluster_id: `cluster-${i + 1}`,
        paper_ids: [],
        abstracts: [],
      },
    })),
    max_concurrent: 5,
    timeout_seconds: 300,
    on_error: 'continue',
  }),

  /**
   * Research gap discovery pipeline
   */
  GAP_DISCOVERY: (query: string, domain: string = 'Computer Science'): MCPWorkflow => ({
    name: 'research_gap_discovery',
    mode: 'sequential',
    steps: [
      {
        tool: 'fetch_openalex',
        input: { query, limit: 30 },
      },
      {
        tool: 'classify_with_groq',
        input: { paper_ids: [], categories: ['Established', 'Emerging', 'Novel'] },
      },
      {
        tool: 'gap_analysis_with_ollama',
        input: { cluster_id: 'main', papers: [], domain },
      },
    ],
    timeout_seconds: 400,
    on_error: 'stop',
  }),

  /**
   * Quick paper fetch and cluster
   */
  QUICK_CLUSTER: (query: string, limit: number = 25): MCPWorkflow => ({
    name: 'quick_cluster',
    mode: 'sequential',
    steps: [
      {
        tool: 'fetch_openalex',
        input: { query, limit },
      },
      {
        tool: 'cluster_papers',
        input: { embedding_ids: [], num_clusters: 3 },
      },
    ],
    timeout_seconds: 120,
    on_error: 'stop',
  }),
};

/**
 * High-level orchestration functions using MCP
 */

/**
 * Execute complete research analysis with MCP orchestration
 */
export async function orchestrateResearchAnalysis(
  userId: string,
  query: string,
  options: {
    limit?: number;
    enableCaching?: boolean;
    workflow?: MCPWorkflow;
  } = {}
): Promise<{
  contextId: string;
  result: MCPWorkflowResult;
  data: MCPContextData;
}> {
  const { limit = 50, workflow } = options;

  console.log('[MCP] Starting orchestrated research analysis for:', query);

  // Create context
  const context = await mcpClient.createContext(userId, query, 7200, {
    source: 'research_hub',
    workflow_type: 'full_analysis',
  });

  console.log('[MCP] Context created:', context.context_id);

  // Execute workflow
  const workflowToRun = workflow || RESEARCH_WORKFLOWS.FULL_ANALYSIS(query, limit);
  const result = await mcpClient.executeWorkflow(context.context_id, workflowToRun);

  console.log('[MCP] Workflow completed:', result.status);

  // Get final context data
  const data = await mcpClient.getContext(context.context_id);

  return {
    contextId: context.context_id,
    result,
    data,
  };
}

/**
 * Execute parallel cluster summarization
 */
export async function orchestrateClusterSummarization(
  userId: string,
  query: string,
  clusters: any[]
): Promise<MCPWorkflowResult> {
  console.log('[MCP] Starting cluster summarization for', clusters.length, 'clusters');

  // Create context
  const context = await mcpClient.createContext(userId, query, 3600, {
    source: 'research_hub',
    workflow_type: 'cluster_summarization',
  });

  // Build parallel workflow for each cluster
  const workflow: MCPWorkflow = {
    name: 'cluster_summarization',
    mode: 'parallel',
    steps: clusters.map((cluster, idx) => ({
      tool: 'summarize_with_gemini',
      input: {
        cluster_id: cluster.id || `cluster-${idx}`,
        paper_ids: cluster.papers?.map((p: any) => p.id) || [],
        abstracts: cluster.papers?.map((p: any) => p.abstract || '') || [],
      },
    })),
    max_concurrent: 5,
    timeout_seconds: 300,
    on_error: 'continue',
  };

  return mcpClient.executeWorkflow(context.context_id, workflow);
}

/**
 * Execute research gap analysis with MCP
 */
export async function orchestrateGapAnalysis(
  userId: string,
  basePaper: any,
  relatedPapers: any[],
  domain: string = 'Computer Science'
): Promise<{
  contextId: string;
  result: MCPWorkflowResult;
  gaps: any[];
}> {
  console.log('[MCP] Starting gap analysis for:', basePaper.title);

  const context = await mcpClient.createContext(
    userId,
    `Research gaps for: ${basePaper.title}`,
    7200,
    {
      base_paper: basePaper.id,
      domain,
    }
  );

  const workflow = RESEARCH_WORKFLOWS.GAP_DISCOVERY(basePaper.title, domain);

  const result = await mcpClient.executeWorkflow(context.context_id, workflow);

  // Extract gaps from workflow results
  const gapResults = result.results.find((r) => r.tool_name === 'gap_analysis_with_ollama');
  const gaps = gapResults?.output?.research_gaps || [];

  return {
    contextId: context.context_id,
    result,
    gaps,
  };
}

/**
 * Get cached results from previous analysis
 */
export async function getCachedAnalysis(
  contextId: string
): Promise<MCPContextData | null> {
  try {
    return await mcpClient.getContext(contextId);
  } catch (error) {
    console.error('[MCP] Failed to get cached analysis:', error);
    return null;
  }
}

/**
 * Check if MCP server is available
 */
export async function checkMCPAvailability(): Promise<boolean> {
  try {
    await mcpClient.healthCheck();
    return true;
  } catch (error) {
    console.warn('[MCP] Server not available:', error);
    return false;
  }
}

export default mcpClient;
