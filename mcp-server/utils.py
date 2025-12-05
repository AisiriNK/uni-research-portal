"""
Utility functions for MCP server.
"""
import json
import logging
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
import redis.asyncio as aioredis
from google.cloud import firestore
from contextlib import asynccontextmanager

from models import ResearchContext

# ============================================================================
# Logging Setup
# ============================================================================

def setup_logging(log_level: str = "INFO"):
    """Configure logging for the MCP server"""
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger("mcp-server")


logger = setup_logging()


# ============================================================================
# Redis Utilities
# ============================================================================

class RedisClient:
    """Redis client wrapper for context storage"""
    
    def __init__(self, redis_url: str, password: Optional[str] = None):
        self.redis_url = redis_url
        self.password = password
        self._client: Optional[aioredis.Redis] = None
    
    async def connect(self):
        """Establish Redis connection"""
        self._client = await aioredis.from_url(
            self.redis_url,
            password=self.password,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50
        )
        logger.info(f"Connected to Redis at {self.redis_url}")
    
    async def disconnect(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()
            logger.info("Disconnected from Redis")
    
    @property
    def client(self) -> aioredis.Redis:
        """Get Redis client"""
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")
        return self._client
    
    async def set_context(self, context_id: str, context: ResearchContext) -> bool:
        """Store context in Redis with TTL"""
        try:
            context_json = context.model_dump_json()
            await self.client.set(
                f"context:{context_id}",
                context_json,
                ex=context.ttl_seconds
            )
            logger.debug(f"Stored context {context_id} with TTL {context.ttl_seconds}s")
            return True
        except Exception as e:
            logger.error(f"Failed to store context {context_id}: {e}")
            return False
    
    async def get_context(self, context_id: str) -> Optional[ResearchContext]:
        """Retrieve context from Redis"""
        try:
            context_json = await self.client.get(f"context:{context_id}")
            if not context_json:
                logger.warning(f"Context {context_id} not found in Redis")
                return None
            return ResearchContext.model_validate_json(context_json)
        except Exception as e:
            logger.error(f"Failed to retrieve context {context_id}: {e}")
            return None
    
    async def update_context(self, context_id: str, updates: Dict[str, Any]) -> bool:
        """Update specific fields in a context"""
        try:
            context = await self.get_context(context_id)
            if not context:
                logger.error(f"Cannot update non-existent context {context_id}")
                return False
            
            # Apply updates
            for key, value in updates.items():
                if hasattr(context, key):
                    setattr(context, key, value)
            
            # Update timestamp
            context.last_updated = datetime.utcnow()
            
            # Store back
            return await self.set_context(context_id, context)
        except Exception as e:
            logger.error(f"Failed to update context {context_id}: {e}")
            return False
    
    async def delete_context(self, context_id: str) -> bool:
        """Delete context from Redis"""
        try:
            result = await self.client.delete(f"context:{context_id}")
            logger.info(f"Deleted context {context_id}")
            return result > 0
        except Exception as e:
            logger.error(f"Failed to delete context {context_id}: {e}")
            return False
    
    async def extend_ttl(self, context_id: str, ttl_seconds: int) -> bool:
        """Extend TTL for a context"""
        try:
            await self.client.expire(f"context:{context_id}", ttl_seconds)
            logger.debug(f"Extended TTL for context {context_id} to {ttl_seconds}s")
            return True
        except Exception as e:
            logger.error(f"Failed to extend TTL for context {context_id}: {e}")
            return False


# ============================================================================
# Firestore Utilities (Optional Persistence)
# ============================================================================

class FirestoreClient:
    """Firestore client wrapper for persistent context storage"""
    
    def __init__(self, project_id: str, credentials_path: Optional[str] = None):
        self.project_id = project_id
        self.credentials_path = credentials_path
        self._client: Optional[firestore.Client] = None
    
    def connect(self):
        """Establish Firestore connection"""
        if self.credentials_path:
            self._client = firestore.Client.from_service_account_json(
                self.credentials_path,
                project=self.project_id
            )
        else:
            self._client = firestore.Client(project=self.project_id)
        logger.info(f"Connected to Firestore project {self.project_id}")
    
    @property
    def client(self) -> firestore.Client:
        """Get Firestore client"""
        if not self._client:
            raise RuntimeError("Firestore client not connected. Call connect() first.")
        return self._client
    
    async def save_context(self, context: ResearchContext) -> bool:
        """Save context to Firestore for persistence"""
        try:
            doc_ref = self.client.collection("research_contexts").document(context.context_id)
            doc_ref.set(context.model_dump(mode='json'))
            logger.info(f"Saved context {context.context_id} to Firestore")
            return True
        except Exception as e:
            logger.error(f"Failed to save context to Firestore: {e}")
            return False
    
    async def load_context(self, context_id: str) -> Optional[ResearchContext]:
        """Load context from Firestore"""
        try:
            doc_ref = self.client.collection("research_contexts").document(context_id)
            doc = doc_ref.get()
            if not doc.exists:
                logger.warning(f"Context {context_id} not found in Firestore")
                return None
            return ResearchContext(**doc.to_dict())
        except Exception as e:
            logger.error(f"Failed to load context from Firestore: {e}")
            return None
    
    async def delete_context(self, context_id: str) -> bool:
        """Delete context from Firestore"""
        try:
            doc_ref = self.client.collection("research_contexts").document(context_id)
            doc_ref.delete()
            logger.info(f"Deleted context {context_id} from Firestore")
            return True
        except Exception as e:
            logger.error(f"Failed to delete context from Firestore: {e}")
            return False


# ============================================================================
# Authentication Utilities
# ============================================================================

def verify_api_key(api_key: str, expected_key: str) -> bool:
    """Verify API key"""
    return api_key == expected_key


def verify_admin_key(api_key: str, admin_key: str) -> bool:
    """Verify admin API key"""
    return api_key == admin_key


# ============================================================================
# Context Utilities
# ============================================================================

def generate_context_id() -> str:
    """Generate a unique context ID"""
    import uuid
    return str(uuid.uuid4())


def calculate_context_size(context: ResearchContext) -> int:
    """Calculate size of context in bytes"""
    return len(context.model_dump_json().encode('utf-8'))


def validate_context_size(context: ResearchContext, max_size_mb: int = 10) -> bool:
    """Validate context doesn't exceed size limit"""
    size_bytes = calculate_context_size(context)
    max_bytes = max_size_mb * 1024 * 1024
    return size_bytes <= max_bytes


# ============================================================================
# Time Utilities
# ============================================================================

def get_expiration_time(ttl_seconds: int) -> datetime:
    """Calculate expiration timestamp"""
    return datetime.utcnow() + timedelta(seconds=ttl_seconds)


def is_expired(timestamp: datetime, ttl_seconds: int) -> bool:
    """Check if a timestamp has expired"""
    expiration = timestamp + timedelta(seconds=ttl_seconds)
    return datetime.utcnow() > expiration


# ============================================================================
# Pagination Utilities
# ============================================================================

def paginate_list(items: list, page: int = 1, per_page: int = 50) -> tuple[list, dict]:
    """Paginate a list and return items + pagination metadata"""
    total = len(items)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    
    paginated = items[start_idx:end_idx]
    
    metadata = {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "has_next": end_idx < total,
        "has_prev": page > 1
    }
    
    return paginated, metadata


# ============================================================================
# Error Handling
# ============================================================================

class MCPError(Exception):
    """Base exception for MCP server errors"""
    pass


class ContextNotFoundError(MCPError):
    """Context not found in storage"""
    pass


class ContextExpiredError(MCPError):
    """Context has expired"""
    pass


class ToolExecutionError(MCPError):
    """Tool execution failed"""
    pass


class WorkflowExecutionError(MCPError):
    """Workflow execution failed"""
    pass


class AuthenticationError(MCPError):
    """Authentication failed"""
    pass


class ValidationError(MCPError):
    """Validation failed"""
    pass


# ============================================================================
# JSON Utilities
# ============================================================================

def safe_json_loads(data: str, default: Any = None) -> Any:
    """Safely load JSON with fallback"""
    try:
        return json.loads(data)
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return default


def safe_json_dumps(data: Any, default: str = "{}") -> str:
    """Safely dump JSON with fallback"""
    try:
        return json.dumps(data)
    except (TypeError, ValueError) as e:
        logger.error(f"JSON encode error: {e}")
        return default
