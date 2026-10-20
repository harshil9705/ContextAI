import json
import logging
from pathlib import Path

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

_store_path: Path | None = None
_documents: list[str] = []
_embeddings: list[list[float]] = []
_metadatas: list[dict] = []


def _get_store_path() -> Path:
    global _store_path
    if _store_path is None:
        _store_path = Path(settings.vector_store_dir)
        _store_path.mkdir(parents=True, exist_ok=True)
    return _store_path


def _load() -> None:
    global _documents, _embeddings, _metadatas
    path = _get_store_path() / "vectors.json"
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        _documents = data.get("documents", [])
        _embeddings = data.get("embeddings", [])
        _metadatas = data.get("metadatas", [])
        logger.info("Loaded %d vectors from disk", len(_documents))
    else:
        _documents, _embeddings, _metadatas = [], [], []


def _save() -> None:
    path = _get_store_path() / "vectors.json"
    path.write_text(
        json.dumps({
            "documents": _documents,
            "embeddings": _embeddings,
            "metadatas": _metadatas,
        }),
        encoding="utf-8",
    )


def init() -> None:
    _load()


def add_chunks(
    item_id: str,
    chunks: list[str],
    embeddings: list[list[float]],
    metadata: dict,
) -> None:
    """Store chunks with their embeddings."""
    if not _documents and not _embeddings:
        _load()

    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        _documents.append(chunk)
        _embeddings.append(emb)
        _metadatas.append({
            "item_id": item_id,
            "chunk_index": i,
            "source_type": metadata.get("source_type", "note"),
            "title": metadata.get("title", ""),
            "created_at": metadata.get("created_at", ""),
        })

    _save()
    logger.info("Stored %d chunks for item %s (total: %d)", len(chunks), item_id, len(_documents))


def delete_item_chunks(item_id: str) -> int:
    """Remove all chunks belonging to an item. Returns count removed."""
    global _documents, _embeddings, _metadatas
    if not _documents and not _embeddings:
        _load()

    indices_to_keep = [i for i, m in enumerate(_metadatas) if m.get("item_id") != item_id]
    removed = len(_documents) - len(indices_to_keep)

    _documents = [_documents[i] for i in indices_to_keep]
    _embeddings = [_embeddings[i] for i in indices_to_keep]
    _metadatas = [_metadatas[i] for i in indices_to_keep]

    _save()
    logger.info("Deleted %d chunks for item %s (remaining: %d)", removed, item_id, len(_documents))
    return removed


def search(query_embedding: list[float], n_results: int = 5) -> dict:
    """Search for the most relevant chunks using cosine similarity."""
    if not _documents and not _embeddings:
        _load()

    if not _embeddings:
        return {"documents": [], "metadatas": [], "distances": []}

    query_vec = np.array(query_embedding)
    stored_vecs = np.array(_embeddings)

    query_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
    stored_norms = stored_vecs / (np.linalg.norm(stored_vecs, axis=1, keepdims=True) + 1e-10)
    similarities = stored_norms @ query_norm

    k = min(n_results, len(_documents))
    top_indices = np.argsort(similarities)[::-1][:k]

    return {
        "documents": [_documents[i] for i in top_indices],
        "metadatas": [_metadatas[i] for i in top_indices],
        "distances": [float(1 - similarities[i]) for i in top_indices],
    }
