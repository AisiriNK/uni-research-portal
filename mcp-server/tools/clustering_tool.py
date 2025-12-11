"""
Clustering Tool - K-means clustering on paper embeddings
"""
import logging
from typing import List, Dict
import numpy as np
from sklearn.cluster import KMeans

from .registry import tool_registry

logger = logging.getLogger(__name__)


@tool_registry.register(
    name="cluster_papers",
    description="Cluster papers using K-means on embeddings",
    category="ml"
)
async def cluster_papers(
    papers: List[Dict],
    embeddings: List[List[float]],
    n_clusters: int = None
) -> Dict:
    """
    Cluster papers using K-means
    
    Args:
        papers: List of paper dictionaries
        embeddings: List of embedding vectors
        n_clusters: Number of clusters (auto if None)
    
    Returns:
        Dictionary with cluster assignments and labels
    """
    try:
        if not papers or not embeddings:
            return {"clusters": [], "labels": []}
        
        if len(papers) != len(embeddings):
            raise ValueError("Papers and embeddings length mismatch")
        
        # Convert to numpy array
        X = np.array(embeddings)
        
        # Auto-determine clusters using elbow method (simplified)
        if n_clusters is None:
            n_clusters = min(max(2, len(papers) // 10), 10)
        
        n_clusters = min(n_clusters, len(papers))
        
        logger.info(f"Clustering {len(papers)} papers into {n_clusters} clusters")
        
        # Perform K-means
        kmeans = KMeans(
            n_clusters=n_clusters,
            random_state=42,
            n_init=10,
            max_iter=300
        )
        labels = kmeans.fit_predict(X)
        
        # Build clusters
        clusters = [[] for _ in range(n_clusters)]
        for idx, label in enumerate(labels):
            paper = papers[idx].copy()
            paper["cluster_id"] = int(label)
            clusters[label].append(paper)
        
        # Generate cluster summaries
        cluster_summaries = []
        for i, cluster_papers in enumerate(clusters):
            if not cluster_papers:
                continue
            
            # Extract top concepts/keywords
            all_concepts = []
            for paper in cluster_papers:
                if "concepts" in paper:
                    all_concepts.extend([c["name"] for c in paper["concepts"][:3]])
            
            # Most common concepts
            from collections import Counter
            top_concepts = [
                concept for concept, _ in Counter(all_concepts).most_common(5)
            ]
            
            cluster_summaries.append({
                "cluster_id": i,
                "size": len(cluster_papers),
                "top_concepts": top_concepts,
                "avg_citations": np.mean([
                    p.get("citation_count", 0) for p in cluster_papers
                ]),
                "year_range": [
                    min(p.get("year", 2024) for p in cluster_papers),
                    max(p.get("year", 2024) for p in cluster_papers)
                ]
            })
        
        logger.info(f"✅ Clustered into {n_clusters} groups")
        
        return {
            "n_clusters": n_clusters,
            "clusters": clusters,
            "labels": labels.tolist(),
            "cluster_summaries": cluster_summaries,
            "inertia": float(kmeans.inertia_)
        }
        
    except Exception as e:
        logger.error(f"❌ Clustering failed: {e}")
        raise


@tool_registry.register(
    name="find_optimal_clusters",
    description="Find optimal number of clusters using elbow method",
    category="ml"
)
async def find_optimal_clusters(
    embeddings: List[List[float]],
    max_clusters: int = 10
) -> Dict:
    """
    Find optimal cluster count using elbow method
    
    Args:
        embeddings: List of embedding vectors
        max_clusters: Maximum clusters to test
    
    Returns:
        Inertia scores for different k values
    """
    try:
        X = np.array(embeddings)
        max_clusters = min(max_clusters, len(embeddings))
        
        inertias = []
        k_range = range(2, max_clusters + 1)
        
        for k in k_range:
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            kmeans.fit(X)
            inertias.append(float(kmeans.inertia_))
        
        # Find elbow (simplified - look for biggest drop)
        diffs = np.diff(inertias)
        optimal_k = int(k_range[np.argmin(diffs)])
        
        return {
            "k_values": list(k_range),
            "inertias": inertias,
            "optimal_k": optimal_k
        }
        
    except Exception as e:
        logger.error(f"❌ Optimal cluster finding failed: {e}")
        raise
