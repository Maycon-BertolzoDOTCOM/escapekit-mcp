"""
FederatedMemoryServer — FastAPI server for aggregating anonymized embeddings.

Endpoints:
  POST /push  — receive an embedding pattern, aggregate by cosine similarity
  GET  /query — query similar patterns, ordered by confidence descending
"""

import json
import os
import uuid
from typing import Optional, Protocol

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, field_validator

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

VECTOR_STORE = os.environ.get("VECTOR_STORE", "chroma")

# ---------------------------------------------------------------------------
# Internal pattern store abstraction
# ---------------------------------------------------------------------------
# Each stored entry is a dict:
#   { "id": str, "embedding": list[float], "meta": dict }
#
# The default implementation uses Chroma; tests can swap it for a plain list.


class _PatternStore(Protocol):
    def get_all(self) -> list[dict]: ...
    def add(self, pattern_id: str, embedding: list[float], metadata: dict) -> None: ...
    def update_meta(self, pattern_id: str, metadata: dict) -> None: ...


class _ChromaStore:
    """Chroma-backed pattern store (default)."""

    def __init__(self) -> None:
        import chromadb

        self._client = chromadb.Client()
        self._col = self._client.get_or_create_collection("public_patterns")

    def get_all(self) -> list[dict]:
        result = self._col.get(include=["embeddings", "metadatas"])
        ids = result.get("ids") or []
        raw_embeddings = result.get("embeddings")
        embeddings = raw_embeddings if raw_embeddings is not None else []
        metadatas = result.get("metadatas") or []
        return [
            {"id": pid, "embedding": list(emb), "meta": dict(meta)}
            for pid, emb, meta in zip(ids, embeddings, metadatas)
        ]

    def add(self, pattern_id: str, embedding: list[float], metadata: dict) -> None:
        self._col.add(ids=[pattern_id], embeddings=[embedding], metadatas=[metadata])

    def update_meta(self, pattern_id: str, metadata: dict) -> None:
        self._col.update(ids=[pattern_id], metadatas=[metadata])


class _InMemoryStore:
    """Pure-Python in-memory store — used in tests for speed."""

    def __init__(self) -> None:
        self._patterns: list[dict] = []

    def get_all(self) -> list[dict]:
        return list(self._patterns)

    def add(self, pattern_id: str, embedding: list[float], metadata: dict) -> None:
        self._patterns.append({"id": pattern_id, "embedding": list(embedding), "meta": dict(metadata)})

    def update_meta(self, pattern_id: str, metadata: dict) -> None:
        for p in self._patterns:
            if p["id"] == pattern_id:
                p["meta"] = dict(metadata)
                return


# Module-level store — replaced by tests via `main._store = _InMemoryStore()`
_store: _PatternStore = _ChromaStore()

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class PushRequest(BaseModel):
    embedding: list[float]
    rule_type: str
    success_count: int
    sector: Optional[str] = None

    @field_validator("embedding")
    @classmethod
    def check_dims(cls, v: list[float]) -> list[float]:
        if len(v) != 384:
            raise ValueError(
                f"embedding must have exactly 384 dimensions, got {len(v)}"
            )
        return v

    @field_validator("success_count")
    @classmethod
    def check_success_count(cls, v: int) -> int:
        if v < 1:
            raise ValueError("success_count must be >= 1")
        return v


class PushResponse(BaseModel):
    status: str
    pattern_id: str


class FederatedPatternResponse(BaseModel):
    pattern_id: str
    confidence: float  # [0, 1]
    rules_applied: list[str]
    success_rate: float  # [0, 1]


class SectorCount(BaseModel):
    sector: str
    count: int


class ClientMetricsRequest(BaseModel):
    engram_hit_rate: float
    vector_hit_rate: float
    federated_hit_rate: float
    validation_cache_hits: int = 0
    validation_cache_misses: int = 0
    avg_validation_time_ms: float = 0.0

    @field_validator("engram_hit_rate", "vector_hit_rate", "federated_hit_rate")
    @classmethod
    def check_hit_rate(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"hit rate must be in [0, 1], got {v}")
        return v


class StatsResponse(BaseModel):
    total_patterns: int
    patterns_by_rule_type: dict[str, int]
    avg_success_rate: float  # [0, 1]
    top_sectors: list[SectorCount]  # até 5, ordenado por count desc
    client_engram_hit_rate: float = 0.0
    client_vector_hit_rate: float = 0.0
    client_federated_hit_rate: float = 0.0
    client_validation_cache_hits: int = 0
    client_validation_cache_misses: int = 0
    client_avg_validation_time_ms: float = 0.0


# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------

# Module-level store — replaced by tests via `main._store = _InMemoryStore()`
_store: _PatternStore = _ChromaStore()

# Module-level client metrics — updated via POST /stats/client-metrics
_client_metrics: Optional[ClientMetricsRequest] = None


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Return cosine similarity in [−1, 1] between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="FederatedMemoryServer")


@app.post("/push", response_model=PushResponse)
def push(request: PushRequest) -> PushResponse:
    """
    Receive an embedding pattern.

    If a stored pattern has cosine similarity >= 0.85 with the incoming
    embedding, increment its success_count instead of inserting a duplicate.
    Otherwise insert a new pattern.
    """
    query_vec = np.array(request.embedding, dtype=np.float64)
    patterns = _store.get_all()

    SIMILARITY_THRESHOLD = 0.85

    for pattern in patterns:
        stored_vec = np.array(pattern["embedding"], dtype=np.float64)
        sim = _cosine_similarity(query_vec, stored_vec)
        if sim >= SIMILARITY_THRESHOLD:
            existing_meta = pattern["meta"]
            new_meta = {
                **existing_meta,
                "success_count": existing_meta.get("success_count", 1) + request.success_count,
                "total_pushes": existing_meta.get("total_pushes", 1) + 1,
            }
            _store.update_meta(pattern["id"], new_meta)
            return PushResponse(status="ok", pattern_id=pattern["id"])

    # No similar pattern found — insert new
    new_id = str(uuid.uuid4())
    metadata: dict = {
        "rule_type": request.rule_type,
        "success_count": request.success_count,
        "total_pushes": 1,
    }
    if request.sector is not None:
        metadata["sector"] = request.sector

    _store.add(new_id, request.embedding, metadata)
    return PushResponse(status="ok", pattern_id=new_id)


@app.get("/query", response_model=list[FederatedPatternResponse])
def query(
    embedding: str = Query(..., description="JSON array of 384 floats"),
    limit: int = Query(default=5, ge=1, le=20),
) -> list[FederatedPatternResponse]:
    """
    Query similar patterns.

    Returns a list of FederatedPatternResponse ordered by confidence
    (cosine similarity) descending, limited to `limit` results.
    """
    try:
        raw = json.loads(embedding)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in embedding: {exc}") from exc

    if not isinstance(raw, list) or len(raw) != 384:
        raise HTTPException(
            status_code=422,
            detail=(
                f"embedding must have exactly 384 dimensions, "
                f"got {len(raw) if isinstance(raw, list) else 'non-list'}"
            ),
        )

    query_vec = np.array(raw, dtype=np.float64)
    patterns = _store.get_all()

    results: list[FederatedPatternResponse] = []
    for pattern in patterns:
        stored_vec = np.array(pattern["embedding"], dtype=np.float64)
        sim = _cosine_similarity(query_vec, stored_vec)
        confidence = max(0.0, min(1.0, sim))

        meta = pattern["meta"]
        success_count = meta.get("success_count", 1)
        total_pushes = meta.get("total_pushes", 1)
        success_rate = min(1.0, success_count / max(1, total_pushes))

        rule_type = meta.get("rule_type", "")
        rules_applied = [rule_type] if rule_type else []

        results.append(
            FederatedPatternResponse(
                pattern_id=pattern["id"],
                confidence=confidence,
                rules_applied=rules_applied,
                success_rate=success_rate,
            )
        )

    results.sort(key=lambda r: r.confidence, reverse=True)
    return results[:limit]


@app.post("/stats/client-metrics")
def post_client_metrics(request: ClientMetricsRequest) -> dict:
    """Receive and store client-side cache metrics."""
    global _client_metrics
    _client_metrics = request
    return {"status": "ok"}


@app.get("/stats", response_model=StatsResponse)
def stats() -> StatsResponse:
    """
    Return aggregated statistics about stored patterns.
    No individual pattern data (no pattern_id, no embedding) is exposed.
    """
    try:
        patterns = _store.get_all()
        total = len(patterns)

        if total == 0:
            return StatsResponse(
                total_patterns=0,
                patterns_by_rule_type={},
                avg_success_rate=0.0,
                top_sectors=[],
                client_engram_hit_rate=_client_metrics.engram_hit_rate if _client_metrics else 0.0,
                client_vector_hit_rate=_client_metrics.vector_hit_rate if _client_metrics else 0.0,
                client_federated_hit_rate=_client_metrics.federated_hit_rate if _client_metrics else 0.0,
                client_validation_cache_hits=_client_metrics.validation_cache_hits if _client_metrics else 0,
                client_validation_cache_misses=_client_metrics.validation_cache_misses if _client_metrics else 0,
                client_avg_validation_time_ms=_client_metrics.avg_validation_time_ms if _client_metrics else 0.0,
            )

        # patterns_by_rule_type
        rule_counts: dict[str, int] = {}
        for p in patterns:
            rt = p["meta"].get("rule_type", "")
            if rt:
                rule_counts[rt] = rule_counts.get(rt, 0) + 1

        # avg_success_rate
        rates = []
        for p in patterns:
            sc = p["meta"].get("success_count", 1)
            tp = p["meta"].get("total_pushes", 1)
            rates.append(min(1.0, sc / max(1, tp)))
        avg_rate = sum(rates) / len(rates) if rates else 0.0

        # top_sectors (até 5)
        sector_counts: dict[str, int] = {}
        for p in patterns:
            sec = p["meta"].get("sector")
            if sec:
                sector_counts[sec] = sector_counts.get(sec, 0) + 1
        top_sectors = [
            SectorCount(sector=s, count=c)
            for s, c in sorted(sector_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]

        return StatsResponse(
            total_patterns=total,
            patterns_by_rule_type=rule_counts,
            avg_success_rate=round(avg_rate, 6),
            top_sectors=top_sectors,
            client_engram_hit_rate=_client_metrics.engram_hit_rate if _client_metrics else 0.0,
            client_vector_hit_rate=_client_metrics.vector_hit_rate if _client_metrics else 0.0,
            client_federated_hit_rate=_client_metrics.federated_hit_rate if _client_metrics else 0.0,
            client_validation_cache_hits=_client_metrics.validation_cache_hits if _client_metrics else 0,
            client_validation_cache_misses=_client_metrics.validation_cache_misses if _client_metrics else 0,
            client_avg_validation_time_ms=_client_metrics.avg_validation_time_ms if _client_metrics else 0.0,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
