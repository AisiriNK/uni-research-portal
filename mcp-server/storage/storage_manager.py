"""
Storage Manager - Smart routing with three-tier fallback
Orchestrates Redis (fast cache) → ChromaDB (permanent) → API calls
"""
import logging
import asyncio
from typing import Optional, Dict, List
from datetime import datetime

from .redis_storage import redis_storage
from .vector_storage import chroma_storage
from config import settings

logger = logging.getLogger(__name__)


class StorageManager:
    """Intelligent storage manager with three-tier fallback"""
    
    def __init__(self):
        self.redis = redis_storage
        self.chroma = chroma_storage
    
    async def initialize(self):
        """Initialize all storage layers"""
        await self.redis.initialize()
        self.chroma.initialize()
        logger.info("✅ Storage Manager initialized")
    
    async def close(self):
        """Close all connections"""
        await self.redis.close()
    
    # ============================================================================
    # CONTEXT MANAGEMENT (Three-tier)
    # ============================================================================
    
    async def get_context(self, context_id: str) -> Optional[Dict]:
        """
        Three-tier context retrieval:
        1. Try Redis (< 1ms)
        2. Try ChromaDB (10-50ms)
        3. Return None
        """
        # Tier 1: Redis
        context = await self.redis.get_context(context_id)
        if context:
            logger.debug(f"✅ Context {context_id[:8]} from Redis")
            return context
        
        # Tier 2: ChromaDB (backup)
        context = await asyncio.to_thread(self.chroma.get_context, context_id)
        if context:
            logger.info(f"⚠️ Context {context_id[:8]} from ChromaDB (Redis miss)")
            # Restore to Redis
            await self.redis.set_context(context_id, context)
            return context
        
        logger.warning(f"❌ Context {context_id[:8]} not found")
        return None
    
    async def create_context(self, context_id: str, context: Dict) -> bool:
        """Create new context in both layers"""
        success = True
        
        # Store in Redis (primary)
        if not await self.redis.set_context(context_id, context):
            logger.warning(f"⚠️ Redis set_context failed for {context_id[:8]}")
            success = False
        
        # Store in ChromaDB (backup)
        if not await asyncio.to_thread(self.chroma.store_context, context_id, context):
            logger.warning(f"⚠️ ChromaDB store_context failed for {context_id[:8]}")
            success = False
        
        return success
    
    async def update_context(self, context_id: str, updates: Dict) -> bool:
        """Update context in both layers"""
        redis_success = await self.redis.update_context(context_id, updates)
        chroma_success = await asyncio.to_thread(self.chroma.update_context, context_id, updates)
        
        return redis_success or chroma_success
    
    async def get_user_contexts(self, user_id: str) -> List[Dict]:
        """Get all user contexts (prefer Redis)"""
        # Try Redis first
        contexts = await self.redis.get_user_contexts(user_id)
        if contexts:
            return contexts
        
        # Fallback to ChromaDB
        return await asyncio.to_thread(self.chroma.get_user_contexts, user_id)
    
    # ============================================================================
    # PAPER MANAGEMENT
    # ============================================================================
    
    async def store_paper(
        self,
        paper_id: str,
        paper: Dict,
        embedding: List[float] = None
    ) -> bool:
        """Store paper in ChromaDB"""
        return await asyncio.to_thread(self.chroma.store_paper, paper_id, paper, embedding)
    
    async def get_paper(self, paper_id: str) -> Optional[Dict]:
        """Get paper from ChromaDB"""
        return await asyncio.to_thread(self.chroma.get_paper, paper_id)
    
    # ============================================================================
    # SUMMARY MANAGEMENT (Three-tier with AI fallback)
    # ============================================================================
    
    async def get_summary(self, paper_id: str) -> Optional[str]:
        """
        Three-tier summary retrieval:
        1. Try Redis (< 1ms)
        2. Try ChromaDB (10-50ms)
        3. Return None (caller should generate via AI)
        """
        # Tier 1: Redis cache
        summary = await self.redis.get_summary(paper_id)
        if summary:
            logger.debug(f"✅ Summary {paper_id[:8]} from Redis")
            return summary
        
        # Tier 2: ChromaDB permanent storage
        summary = await asyncio.to_thread(self.chroma.get_summary, paper_id)
        if summary:
            logger.info(f"⚠️ Summary {paper_id[:8]} from ChromaDB (Redis miss)")
            # Restore to Redis
            await self.redis.cache_summary(paper_id, summary)
            return summary
        
        # Tier 3: Needs generation
        logger.info(f"ℹ️ Summary {paper_id[:8]} not cached (will generate)")
        return None
    
    async def store_summary(self, paper_id: str, summary: str) -> bool:
        """Store summary in both layers"""
        # Store in Redis (fast cache)
        redis_success = await self.redis.cache_summary(paper_id, summary)
        
        # Store in ChromaDB (permanent)
        chroma_success = await asyncio.to_thread(self.chroma.store_summary, paper_id, summary)
        
        if redis_success and chroma_success:
            logger.info(f"✅ Summary {paper_id[:8]} stored in both layers")
        elif chroma_success:
            logger.warning(f"⚠️ Summary {paper_id[:8]} stored only in ChromaDB")
        elif redis_success:
            logger.warning(f"⚠️ Summary {paper_id[:8]} stored only in Redis")
        else:
            logger.error(f"❌ Summary {paper_id[:8]} storage failed")
        
        return redis_success or chroma_success
    
    # ============================================================================
    # RESEARCH GAPS MANAGEMENT (Three-tier)
    # ============================================================================
    
    async def get_gaps(self, paper_id: str) -> Optional[List[str]]:
        """
        Three-tier gaps retrieval:
        1. Try Redis (< 1ms)
        2. Try ChromaDB (10-50ms)
        3. Return None (caller should generate via AI)
        """
        # Tier 1: Redis cache
        gaps = await self.redis.get_gaps(paper_id)
        if gaps:
            logger.debug(f"✅ Gaps {paper_id[:8]} from Redis")
            return gaps
        
        # Tier 2: ChromaDB permanent storage
        gaps = await asyncio.to_thread(self.chroma.get_gaps, paper_id)
        if gaps:
            logger.info(f"⚠️ Gaps {paper_id[:8]} from ChromaDB (Redis miss)")
            # Restore to Redis
            await self.redis.cache_gaps(paper_id, gaps)
            return gaps
        
        # Tier 3: Needs generation
        logger.info(f"ℹ️ Gaps {paper_id[:8]} not cached (will generate)")
        return None
    
    async def store_gaps(self, paper_id: str, gaps: List[str]) -> bool:
        """Store gaps in both layers"""
        # Store in Redis (fast cache)
        redis_success = await self.redis.cache_gaps(paper_id, gaps)
        
        # Store in ChromaDB (permanent)
        chroma_success = await asyncio.to_thread(self.chroma.store_gaps, paper_id, gaps)
        
        if redis_success and chroma_success:
            logger.info(f"✅ Gaps {paper_id[:8]} stored in both layers")
        elif chroma_success:
            logger.warning(f"⚠️ Gaps {paper_id[:8]} stored only in ChromaDB")
        elif redis_success:
            logger.warning(f"⚠️ Gaps {paper_id[:8]} stored only in Redis")
        else:
            logger.error(f"❌ Gaps {paper_id[:8]} storage failed")
        
        return redis_success or chroma_success
    
    # ============================================================================
    # SEMANTIC SEARCH
    # ============================================================================
    
    async def semantic_search(
        self,
        query_embedding: List[float],
        limit: int = 10,
        filters: Dict = None
    ) -> List[Dict]:
        """Semantic search via ChromaDB"""
        return await asyncio.to_thread(self.chroma.semantic_search, query_embedding, limit, filters)
    
    async def find_similar_papers(
        self,
        paper_id: str,
        limit: int = 5
    ) -> List[Dict]:
        """Find similar papers via ChromaDB"""
        return await asyncio.to_thread(self.chroma.find_similar_papers, paper_id, limit)
    
    # ============================================================================
    # STATISTICS & HEALTH
    # ============================================================================
    
    async def get_stats(self) -> Dict:
        """Get statistics from all storage layers"""
        redis_stats = await self.redis.get_stats()
        chroma_stats = await asyncio.to_thread(self.chroma.get_stats)
        
        return {
            "redis": redis_stats,
            "chromadb": chroma_stats,
            "storage_manager": {
                "status": "healthy",
                "three_tier_enabled": True
            }
        }


# Global instance
storage_manager = StorageManager()
