"""
Tests for FederatedMemoryServer — pytest + hypothesis.

Property tests:
  P15: GET /query returns results ordered by confidence descending
  P16: POST /push with embedding dimension != 384 returns HTTP 422
  P17: Two pushes with cosine similarity >= 0.85 result in a single pattern
       with incremented success_count
"""

import json

import numpy as np
import pytest
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

import main as server_module
from main import _InMemoryStore, app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fresh_client() -> TestClient:
    """Return a TestClient backed by a fresh in-memory store (fast, no Chroma)."""
    server_module._store = _InMemoryStore()
    return TestClient(app)


def _unit_vector(seed: int, dims: int = 384) -> list[float]:
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(dims)
    v = v / np.linalg.norm(v)
    return v.tolist()


def _push_payload(embedding: list[float], rule_type: str = "LGPD", success_count: int = 1):
    return {"embedding": embedding, "rule_type": rule_type, "success_count": success_count}


def _perturb_embedding(base: list[float], noise_scale: float = 0.01) -> list[float]:
    """Return a slightly perturbed version of base with cosine similarity >= 0.85."""
    rng = np.random.default_rng(42)
    v = np.array(base)
    noise = rng.standard_normal(len(v)) * noise_scale
    perturbed = v + noise
    perturbed = perturbed / np.linalg.norm(perturbed)
    return perturbed.tolist()


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

invalid_embedding_st = st.one_of(
    st.lists(st.floats(allow_nan=False, allow_infinity=False), min_size=0, max_size=383),
    st.lists(st.floats(allow_nan=False, allow_infinity=False), min_size=385, max_size=500),
)

rule_type_st = st.text(
    min_size=1,
    max_size=10,
    alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
)


# ---------------------------------------------------------------------------
# P15: GET /query returns results ordered by confidence descending
# ---------------------------------------------------------------------------


@given(
    seeds=st.lists(st.integers(min_value=0, max_value=999), min_size=1, max_size=5),
    query_seed=st.integers(min_value=0, max_value=999),
    limit=st.integers(min_value=1, max_value=20),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p15_query_results_ordered_by_confidence(seeds, query_seed, limit):
    """
    Feature: federated-memory, Property 15: Resultados ordenados por confidence decrescente
    Validates: Requirements 7.3
    """
    client = _fresh_client()

    for seed in seeds:
        emb = _unit_vector(seed)
        resp = client.post("/push", json=_push_payload(emb))
        assert resp.status_code == 200

    query_emb = _unit_vector(query_seed)
    resp = client.get("/query", params={"embedding": json.dumps(query_emb), "limit": limit})
    assert resp.status_code == 200

    results = resp.json()
    confidences = [r["confidence"] for r in results]

    assert confidences == sorted(confidences, reverse=True), (
        f"Results not sorted by confidence descending: {confidences}"
    )
    assert len(results) <= limit


# ---------------------------------------------------------------------------
# P16: POST /push with embedding dimension != 384 returns HTTP 422
# ---------------------------------------------------------------------------


@given(embedding=invalid_embedding_st)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p16_push_rejects_wrong_dimension(embedding):
    """
    Feature: federated-memory, Property 16: Servidor rejeita embedding com dimensão errada
    Validates: Requirements 7.4
    """
    client = _fresh_client()
    payload = {"embedding": embedding, "rule_type": "LGPD", "success_count": 1}
    resp = client.post("/push", json=payload)
    assert resp.status_code == 422, (
        f"Expected 422 for embedding of length {len(embedding)}, got {resp.status_code}"
    )


# ---------------------------------------------------------------------------
# P17: Two pushes with cosine similarity >= 0.85 → single pattern, incremented success_count
# ---------------------------------------------------------------------------


@given(
    seed=st.integers(min_value=0, max_value=999),
    rule_type=rule_type_st,
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p17_similar_embeddings_aggregate(seed, rule_type):
    """
    Feature: federated-memory, Property 17: Dois pushes similares resultam em padrão único com success_count incrementado
    Validates: Requirements 7.6
    """
    client = _fresh_client()

    base_emb = _unit_vector(seed)
    similar_emb = _perturb_embedding(base_emb, noise_scale=0.01)

    a = np.array(base_emb)
    b = np.array(similar_emb)
    sim = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    assert sim >= 0.85, f"Test setup error: similarity {sim:.4f} < 0.85"

    resp1 = client.post("/push", json=_push_payload(base_emb, rule_type=rule_type, success_count=1))
    assert resp1.status_code == 200
    pattern_id_1 = resp1.json()["pattern_id"]

    resp2 = client.post("/push", json=_push_payload(similar_emb, rule_type=rule_type, success_count=1))
    assert resp2.status_code == 200
    pattern_id_2 = resp2.json()["pattern_id"]

    assert pattern_id_1 == pattern_id_2, (
        f"Expected same pattern_id for similar embeddings (sim={sim:.4f}), "
        f"got {pattern_id_1} and {pattern_id_2}"
    )

    resp_q = client.get("/query", params={"embedding": json.dumps(base_emb), "limit": 20})
    assert resp_q.status_code == 200
    patterns = resp_q.json()

    matching = [p for p in patterns if p["pattern_id"] == pattern_id_1]
    assert len(matching) == 1

    # success_count=2, total_pushes=2 → success_rate = 1.0
    assert matching[0]["success_rate"] == pytest.approx(1.0, abs=1e-6)
