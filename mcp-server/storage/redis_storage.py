"""
Redis cache layer for fast access
Handles contexts, summaries, and temporary data with TTL
"""
import redis.asyncio as redis
import json
from typing import Optional, Dict, List
from datetime import datetime
import logging

from config import settings

logger = logging.getLogger(__name__)


class RedisStorage:
    """Redis cache layer with TTL management"""
    
    def __init__(self):
        self.client: Optional[redis.Redis] = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize Redis connection"""
        if self._initialized:
            return
        
        try:
            self.client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD,
                decode_responses=True,
                max_connections=settings.REDIS_MAX_CONNECTIONS
            )
            
            # Test connection
            await self.client.ping()
            self._initialized = True
            logger.info("✅ Redis connected successfully")
            
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            self.client = None
            self._initialized = False
    
    async def close(self):
        """Close Redis connection"""
        if self.client:
            await self.client.close()
            self._initialized = False
    
    # ============================================================================
    # CONTEXT MANAGEMENT
    # ============================================================================
    
    async def set_context(
        self,
        context_id: str,
        context: Dict,
        ttl: int = None
    ) -> bool:
        """Store context with TTL"""
        if not self.client:
            return False
        
        try:
            ttl = ttl or settings.CONTEXT_CACHE_TTL
            await self.client.setex(
                f"context:{context_id}",
                ttl,
                json.dumps(context, default=str)
            )
            return True
        except Exception as e:
            logger.error(f"Redis set_context error: {e}")
            return False
    
    async def get_context(self, context_id: str) -> Optional[Dict]:
        """Get context from cache"""
        if not self.client:
            return None
        
        try:
            data = await self.client.get(f"context:{context_id}")
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Redis get_context error: {e}")
            return None
    
    async def update_context(
        self,
        context_id: str,
        updates: Dict
    ) -> bool:
        """Update context with new data"""
        if not self.client:
            return False
        
        try:
            # Get existing context
            context = await self.get_context(context_id)
            if not context:
                return False
            
            # Merge updates
            context.update(updates)
            
            # Get remaining TTL
            ttl = await self.client.ttl(f"context:{context_id}")
            if ttl <= 0:
                ttl = settings.CONTEXT_CACHE_TTL
            
            # Save updated context
            return await self.set_context(context_id, context, ttl)
            
        except Exception as e:
            logger.error(f"Redis update_context error: {e}")
            return False
    
    async def delete_context(self, context_id: str) -> bool:
        """Delete context from cache"""
        if not self.client:
            return False
        
        try:
            await self.client.delete(f"context:{context_id}")
            return True
        except Exception as e:
            logger.error(f"Redis delete_context error: {e}")
            return False
    
    async def get_user_contexts(self, user_id: str) -> List[Dict]:
        """Get all active contexts for a user"""
        if not self.client:
            return []
        
        try:
            # Scan for all context keys
            keys = []
            async for key in self.client.scan_iter(match="context:*"):
                keys.append(key)
            
            # Get all contexts
            contexts = []
            for key in keys:
                data = await self.client.get(key)
                if data:
                    context = json.loads(data)
                    if context.get('owner_id') == user_id:
                        contexts.append(context)
            
            return contexts
            
        except Exception as e:
            logger.error(f"Redis get_user_contexts error: {e}")
            return []
    
    # ============================================================================
    # SUMMARY CACHING
    # ============================================================================
    
    async def cache_summary(
        self,
        paper_id: str,
        summary: str,
        ttl: int = None
    ) -> bool:
        """Cache paper summary"""
        if not self.client:
            return False
        
        try:
            ttl = ttl or settings.SUMMARY_CACHE_TTL
            await self.client.setex(
                f"summary:{paper_id}",
                ttl,
                summary
            )
            return True
        except Exception as e:
            logger.error(f"Redis cache_summary error: {e}")
            return False
    
    async def get_summary(self, paper_id: str) -> Optional[str]:
        """Get cached summary"""
        if not self.client:
            return None
        
        try:
            return await self.client.get(f"summary:{paper_id}")
        except Exception as e:
            logger.error(f"Redis get_summary error: {e}")
            return None
    
    # ============================================================================
    # RESEARCH GAPS CACHING
    # ============================================================================
    
    async def cache_gaps(
        self,
        paper_id: str,
        gaps: List[str],
        ttl: int = None
    ) -> bool:
        """Cache research gaps"""
        if not self.client:
            return False
        
        try:
            ttl = ttl or settings.GAPS_CACHE_TTL
            await self.client.setex(
                f"gaps:{paper_id}",
                ttl,
                json.dumps(gaps)
            )
            return True
        except Exception as e:
            logger.error(f"Redis cache_gaps error: {e}")
            return False
    
    async def get_gaps(self, paper_id: str) -> Optional[List[str]]:
        """Get cached research gaps"""
        if not self.client:
            return None
        
        try:
            data = await self.client.get(f"gaps:{paper_id}")
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Redis get_gaps error: {e}")
            return None
    
    # ============================================================================
    # STATISTICS
    # ============================================================================
    
    async def get_stats(self) -> Dict:
        """Get Redis statistics"""
        if not self.client:
            return {
                "status": "disconnected",
                "active_contexts": 0,
                "total_keys": 0
            }
        
        try:
            info = await self.client.info()
            
            # Count context keys
            context_count = 0
            async for key in self.client.scan_iter(match="context:*"):
                context_count += 1
            
            return {
                "status": "connected",
                "active_contexts": context_count,
                "total_keys": await self.client.dbsize(),
                "used_memory_mb": round(info['used_memory'] / (1024 * 1024), 2),
                "connected_clients": info.get('connected_clients', 0)
            }
            
        except Exception as e:
            logger.error(f"Redis get_stats error: {e}")
            return {
                "status": "error",
                "error": str(e)
            }


# Global instance
redis_storage = RedisStorage()
