"""Tools for MCP Server"""
from .registry import tool_registry, Tool
from .openalex_tool import fetch_papers
from .embedding_tool import generate_embedding, generate_embeddings_batch
from .clustering_tool import cluster_papers
from .gemini_tool import summarize_with_gemini
from .groq_tool import find_gaps_with_groq, summarize_with_groq

__all__ = [
    "tool_registry",
    "Tool",
    "fetch_papers",
    "generate_embedding",
    "generate_embeddings_batch",
    "cluster_papers",
    "summarize_with_gemini",
    "find_gaps_with_groq",
    "summarize_with_groq"
]
