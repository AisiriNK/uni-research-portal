"""
ChromaDB vector storage for semantic search and permanent storage
Handles papers, embeddings, summaries, and clustering
"""
import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Optional
from datetime import datetime
import json
import logging
import numpy as np

from config import settings

logger = logging.getLogger(__name__)


class ChromaDBStorage:
    """ChromaDB storage for semantic operations"""
    
    def __init__(self):
        self.client: Optional[chromadb.Client] = None
        self.papers_collection = None
        self.contexts_collection = None
        self._initialized = False
    
    def initialize(self):
        """Initialize ChromaDB"""
        if self._initialized:
            return
        
        try:
            # Initialize client
            self.client = chromadb.Client(ChromaSettings(
                persist_directory=settings.CHROMA_PERSIST_DIR,
                anonymized_telemetry=False
            ))
            
            # Create/get collections
            self.papers_collection = self.client.get_or_create_collection(
                name="research_papers",
                metadata={"description": "Academic papers with embeddings"}
            )
            
            self.contexts_collection = self.client.get_or_create_collection(
                name="user_contexts",
                metadata={"description": "User research contexts"}
            )
            
            self._initialized = True
            logger.info(f"✅ ChromaDB initialized: {self.papers_collection.count()} papers")
            
        except Exception as e:
            logger.error(f"❌ ChromaDB initialization failed: {e}")
            self._initialized = False
    
    # ============================================================================
    # PAPER MANAGEMENT
    # ============================================================================
    
    def store_paper(
        self,
        paper_id: str,
        paper: Dict,
        embedding: List[float] = None
    ) -> bool:
        """Store paper with optional embedding"""
        if not self._initialized:
            self.initialize()
        
        try:
            metadata = {
                "title": paper.get('title', '')[:500],  # Limit length
                "abstract": paper.get('abstract', '')[:1000],
                "authors": str(paper.get('authors', []))[:500],
                "year": paper.get('year'),
                "doi": paper.get('doi', ''),
                "citation_count": paper.get('citation_count', 0),
                "venue": paper.get('venue', ''),
                "indexed_at": datetime.now().isoformat()
            }
            
            # Remove None values
            metadata = {k: v for k, v in metadata.items() if v is not None}
            
            if embedding:
                self.papers_collection.upsert(
                    ids=[paper_id],
                    embeddings=[embedding],
                    metadatas=[metadata],
                    documents=[paper.get('abstract', paper.get('title', ''))]
                )
            else:
                self.papers_collection.upsert(
                    ids=[paper_id],
                    metadatas=[metadata],
                    documents=[paper.get('abstract', paper.get('title', ''))]
                )
            
            return True
            
        except Exception as e:
            logger.error(f"ChromaDB store_paper error: {e}")
            return False
    
    def get_paper(self, paper_id: str) -> Optional[Dict]:
        """Get paper by ID"""
        if not self._initialized:
            self.initialize()
        
        try:
            result = self.papers_collection.get(
                ids=[paper_id],
                include=["metadatas", "documents"]
            )
            
            if result['metadatas']:
                paper = result['metadatas'][0].copy()
                paper['paper_id'] = paper_id
                if result['documents']:
                    paper['abstract'] = result['documents'][0]
                return paper
            
            return None
            
        except Exception as e:
            logger.error(f"ChromaDB get_paper error: {e}")
            return None
    
    def store_summary(self, paper_id: str, summary: str) -> bool:
        """Update paper with summary"""
        if not self._initialized:
            self.initialize()
        
        try:
            # Get existing paper
            paper = self.get_paper(paper_id)
            if not paper:
                return False
            
            # Update with summary
            paper['summary'] = summary
            paper['summary_generated_at'] = datetime.now().isoformat()
            
            self.papers_collection.update(
                ids=[paper_id],
                metadatas=[paper]
            )
            
            return True
            
        except Exception as e:
            logger.error(f"ChromaDB store_summary error: {e}")
            return False
    
    def get_summary(self, paper_id: str) -> Optional[str]:
        """Get paper summary"""
        paper = self.get_paper(paper_id)
        if paper:
            return paper.get('summary')
        return None
    
    def store_gaps(self, paper_id: str, gaps: List[str]) -> bool:
        """Store research gaps for paper"""
        if not self._initialized:
            self.initialize()
        
        try:
            paper = self.get_paper(paper_id)
            if not paper:
                return False
            
            paper['research_gaps'] = str(gaps)
            paper['gaps_generated_at'] = datetime.now().isoformat()
            
            self.papers_collection.update(
                ids=[paper_id],
                metadatas=[paper]
            )
            
            return True
            
        except Exception as e:
            logger.error(f"ChromaDB store_gaps error: {e}")
            return False
    
    def get_gaps(self, paper_id: str) -> Optional[List[str]]:
        """Get research gaps"""
        paper = self.get_paper(paper_id)
        if paper and paper.get('research_gaps'):
            try:
                return eval(paper['research_gaps'])
            except:
                return None
        return None
    
    # ============================================================================
    # SEMANTIC SEARCH
    # ============================================================================
    
    def semantic_search(
        self,
        query_embedding: List[float],
        limit: int = 10,
        filters: Dict = None
    ) -> List[Dict]:
        """Semantic search using embeddings"""
        if not self._initialized:
            self.initialize()
        
        try:
            results = self.papers_collection.query(
                query_embeddings=[query_embedding],
                n_results=limit,
                where=filters,
                include=["metadatas", "distances"]
            )
            
            papers = []
            if results['ids']:
                for i, paper_id in enumerate(results['ids'][0]):
                    paper = results['metadatas'][0][i].copy()
                    paper['paper_id'] = paper_id
                    paper['similarity_score'] = 1 - results['distances'][0][i]
                    papers.append(paper)
            
            return papers
            
        except Exception as e:
            logger.error(f"ChromaDB semantic_search error: {e}")
            return []
    
    def find_similar_papers(
        self,
        paper_id: str,
        limit: int = 5
    ) -> List[Dict]:
        """Find similar papers"""
        if not self._initialized:
            self.initialize()
        
        try:
            # Get paper embedding
            result = self.papers_collection.get(
                ids=[paper_id],
                include=["embeddings"]
            )
            
            if not result['embeddings']:
                return []
            
            # Search for similar
            results = self.papers_collection.query(
                query_embeddings=result['embeddings'],
                n_results=limit + 1,
                include=["metadatas", "distances"]
            )
            
            similar = []
            if results['ids']:
                for i, pid in enumerate(results['ids'][0]):
                    if pid != paper_id:  # Exclude query paper
                        paper = results['metadatas'][0][i].copy()
                        paper['paper_id'] = pid
                        paper['similarity_score'] = 1 - results['distances'][0][i]
                        similar.append(paper)
            
            return similar[:limit]
            
        except Exception as e:
            logger.error(f"ChromaDB find_similar_papers error: {e}")
            return []
    
    # ============================================================================
    # CONTEXT MANAGEMENT (Backup)
    # ============================================================================
    
    def store_context(self, context_id: str, context: Dict) -> bool:
        """Store context as backup"""
        if not self._initialized:
            self.initialize()
        
        try:
            metadata = {
                "owner_id": context.get('owner_id', ''),
                "query": context.get('query', ''),
                "created_at": context.get('created_at', ''),
                "status": context.get('status', 'active')
            }
            
            self.contexts_collection.upsert(
                ids=[context_id],
                metadatas=[metadata],
                documents=[json.dumps(context, default=str)]
            )
            
            return True
            
        except Exception as e:
            logger.error(f"ChromaDB store_context error: {e}")
            return False
    
    def get_context(self, context_id: str) -> Optional[Dict]:
        """Get context from backup"""
        if not self._initialized:
            self.initialize()
        
        try:
            result = self.contexts_collection.get(
                ids=[context_id],
                include=["documents"]
            )
            
            if result['documents']:
                return json.loads(result['documents'][0])
            
            return None
            
        except Exception as e:
            logger.error(f"ChromaDB get_context error: {e}")
            return None
    
    def update_context(self, context_id: str, updates: Dict) -> bool:
        """Update context"""
        context = self.get_context(context_id)
        if context:
            context.update(updates)
            return self.store_context(context_id, context)
        return False
    
    def get_user_contexts(self, user_id: str) -> List[Dict]:
        """Get all contexts for user"""
        if not self._initialized:
            self.initialize()
        
        try:
            results = self.contexts_collection.get(
                where={"owner_id": user_id},
                include=["documents"]
            )
            
            contexts = []
            if results['documents']:
                for doc in results['documents']:
                    contexts.append(json.loads(doc))
            
            return contexts
            
        except Exception as e:
            logger.error(f"ChromaDB get_user_contexts error: {e}")
            return []
    
    # ============================================================================
    # STATISTICS
    # ============================================================================
    
    def get_stats(self) -> Dict:
        """Get ChromaDB statistics"""
        if not self._initialized:
            self.initialize()
        
        try:
            return {
                "status": "initialized" if self._initialized else "not_initialized",
                "total_papers": self.papers_collection.count() if self.papers_collection else 0,
                "total_contexts": self.contexts_collection.count() if self.contexts_collection else 0,
                "embedding_dimension": settings.EMBEDDING_DIM
            }
        except Exception as e:
            logger.error(f"ChromaDB get_stats error: {e}")
            return {"status": "error", "error": str(e)}


# Global instance
chroma_storage = ChromaDBStorage()
