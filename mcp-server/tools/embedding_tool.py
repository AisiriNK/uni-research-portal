"""
Embedding Tool - Generate embeddings using SentenceTransformers
Model: all-MiniLM-L6-v2 (384 dimensions)
"""
import logging
from typing import List
from sentence_transformers import SentenceTransformer
import numpy as np

from .registry import tool_registry
from config import settings

logger = logging.getLogger(__name__)

# Global model instance (lazy loaded)
_model: SentenceTransformer = None


def get_embedding_model() -> SentenceTransformer:
    """Get or initialize embedding model"""
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info(f"✅ Model loaded: {_model.get_sentence_embedding_dimension()}D")
    return _model


@tool_registry.register(
    name="generate_embedding",
    description="Generate embedding for a single text",
    category="ml"
)
async def generate_embedding(text: str) -> List[float]:
    """
    Generate embedding vector for text
    
    Args:
        text: Input text
    
    Returns:
        Embedding vector (384 dimensions)
    """
    try:
        if not text or not text.strip():
            logger.warning("Empty text provided for embedding")
            return [0.0] * settings.EMBEDDING_DIM
        
        model = get_embedding_model()
        embedding = model.encode(text, convert_to_numpy=True)
        
        # Convert to list
        return embedding.tolist()
        
    except Exception as e:
        logger.error(f"❌ Embedding generation failed: {e}")
        raise


@tool_registry.register(
    name="generate_embeddings_batch",
    description="Generate embeddings for multiple texts (batch processing)",
    category="ml"
)
async def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for multiple texts (more efficient than single)
    
    Args:
        texts: List of input texts
    
    Returns:
        List of embedding vectors
    """
    try:
        if not texts:
            return []
        
        # Handle empty texts
        processed_texts = [text if text and text.strip() else " " for text in texts]
        
        model = get_embedding_model()
        embeddings = model.encode(
            processed_texts,
            convert_to_numpy=True,
            batch_size=32,
            show_progress_bar=len(texts) > 100
        )
        
        logger.info(f"✅ Generated {len(embeddings)} embeddings")
        return embeddings.tolist()
        
    except Exception as e:
        logger.error(f"❌ Batch embedding generation failed: {e}")
        raise


@tool_registry.register(
    name="compute_similarity",
    description="Compute cosine similarity between two embeddings",
    category="ml"
)
async def compute_similarity(
    embedding1: List[float],
    embedding2: List[float]
) -> float:
    """
    Compute cosine similarity between embeddings
    
    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector
    
    Returns:
        Similarity score (0-1)
    """
    try:
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        # Cosine similarity
        similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
        
        return float(similarity)
        
    except Exception as e:
        logger.error(f"❌ Similarity computation failed: {e}")
        raise
