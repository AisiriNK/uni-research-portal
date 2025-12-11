"""
Configuration management for MCP Server
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # API Keys
    API_KEY: str = "development-key"
    ADMIN_API_KEY: str = "admin-key"
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    
    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_MAX_CONNECTIONS: int = 10
    REDIS_PASSWORD: Optional[str] = None
    
    # ChromaDB Configuration
    CHROMA_PERSIST_DIR: str = "./data/chroma_db"
    CHROMA_COLLECTION_NAME: str = "research_papers"
    
    # Rate Limits (calls per minute)
    GEMINI_RATE_LIMIT: int = 5
    GROQ_RATE_LIMIT: int = 10
    OPENALEX_RATE_LIMIT: int = 10
    
    # Cache TTL (seconds)
    SUMMARY_CACHE_TTL: int = 604800  # 7 days
    CONTEXT_CACHE_TTL: int = 86400   # 24 hours
    GAPS_CACHE_TTL: int = 604800     # 7 days
    
    # Embedding Configuration
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384
    
    # Server Configuration
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"
    
    # Workflow Configuration
    MAX_RETRY_ATTEMPTS: int = 3
    RETRY_BACKOFF_FACTOR: float = 2.0
    WORKFLOW_TIMEOUT: int = 300  # 5 minutes
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
