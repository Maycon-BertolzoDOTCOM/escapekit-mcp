"""
Tests for GET /stats endpoint — pytest + hypothesis.

Property tests:
  P7: GET /stats com store vazio → retorna zeros
  P8: GET /stats → top_sectors tem no máximo 5 entradas
  P9: GET /stats → avg_success_rate está em [0, 1]
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

import main as server_module
from main import _InMemoryStore, app


# ---------------------------------------------------------------------------
# Helpers (mesmos padrões de test_server.py)
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


def _push(client: TestClient, seed: int, rule_type: str = "LGPD", sector: str | None = None, success_count: int = 1) -> None:
    payload: dict = {
        "embedding": _unit_vector(seed),
        "rule_type": rule_type,
        "success_count": success_count,
    }
    if sector is not None:
        payload["sector"] = sector
    resp = client.post("/push", json=payload)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

sector_st = st.text(
    min_size=1,
    max_size=20,
    alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
)

rule_type_st = st.text(
    min_size=1,
    max_size=10,
    alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
)

pattern_st = st.fixed_dictionaries({
    "seed": st.integers(min_value=0, max_value=9999),
    "rule_type": rule_type_st,
    "sector": st.one_of(st.none(), sector_st),
    "success_count": st.integers(min_value=1, max_value=100),
})


# ---------------------------------------------------------------------------
# P7: GET /stats com store vazio → retorna zeros
# ---------------------------------------------------------------------------


def test_p7_stats_empty_store():
    """
    **Validates: Requirements 3.2**

    P7: GET /stats com store vazio → retorna zeros/listas vazias.
    """
    client = _fresh_client()
    resp = client.get("/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patterns"] == 0
    assert data["patterns_by_rule_type"] == {}
    assert data["avg_success_rate"] == 0.0
    assert data["top_sectors"] == []


# ---------------------------------------------------------------------------
# P8: GET /stats → top_sectors tem no máximo 5 entradas
# ---------------------------------------------------------------------------


@given(patterns=st.lists(pattern_st, min_size=0, max_size=30))
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p8_top_sectors_at_most_five(patterns):
    """
    **Validates: Requirements 3.4**

    P8: GET /stats → top_sectors tem no máximo 5 entradas, independente do número de setores distintos.
    """
    client = _fresh_client()

    for i, p in enumerate(patterns):
        # Use index to ensure unique seeds across patterns
        seed = (p["seed"] + i * 10000) % 100000
        _push(client, seed=seed, rule_type=p["rule_type"], sector=p["sector"], success_count=p["success_count"])

    resp = client.get("/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["top_sectors"]) <= 5


# ---------------------------------------------------------------------------
# P9: GET /stats → avg_success_rate está em [0, 1]
# ---------------------------------------------------------------------------


@given(patterns=st.lists(pattern_st, min_size=1, max_size=20))
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p9_avg_success_rate_in_range(patterns):
    """
    **Validates: Requirements 3.3**

    P9: GET /stats → avg_success_rate está sempre no intervalo [0, 1].
    """
    client = _fresh_client()

    for i, p in enumerate(patterns):
        seed = (p["seed"] + i * 10000) % 100000
        _push(client, seed=seed, rule_type=p["rule_type"], sector=p["sector"], success_count=p["success_count"])

    resp = client.get("/stats")
    assert resp.status_code == 200
    data = resp.json()
    rate = data["avg_success_rate"]
    assert 0.0 <= rate <= 1.0, f"avg_success_rate={rate} fora do intervalo [0, 1]"


# ---------------------------------------------------------------------------
# P5: Round-trip POST → GET /stats para métricas de cliente
# Feature: engram-cache, Property 5
# ---------------------------------------------------------------------------


@given(
    engram=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    vector=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    federated=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p5_client_metrics_round_trip(engram, vector, federated):
    """
    **Validates: Requirement 3.4**

    # Feature: engram-cache, Property 5
    P5: Valores enviados via POST /stats/client-metrics aparecem corretamente no GET /stats.
    """
    server_module._client_metrics = None
    client = _fresh_client()

    resp = client.post("/stats/client-metrics", json={
        "engram_hit_rate": engram,
        "vector_hit_rate": vector,
        "federated_hit_rate": federated,
    })
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    stats_resp = client.get("/stats")
    assert stats_resp.status_code == 200
    data = stats_resp.json()

    assert data["client_engram_hit_rate"] == pytest.approx(engram)
    assert data["client_vector_hit_rate"] == pytest.approx(vector)
    assert data["client_federated_hit_rate"] == pytest.approx(federated)


# ---------------------------------------------------------------------------
# P6: Rejeição de payload inválido em /stats/client-metrics
# Feature: engram-cache, Property 6
# ---------------------------------------------------------------------------


@given(
    invalid_value=st.floats().filter(lambda x: not (0.0 <= x <= 1.0) and not (x != x) and not (x == float('inf')) and not (x == float('-inf'))),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p6_invalid_client_metrics_rejected(invalid_value):
    """
    **Validates: Requirement 3.6**

    # Feature: engram-cache, Property 6
    P6: POST /stats/client-metrics com qualquer campo fora de [0, 1] retorna HTTP 422.
    """
    client = _fresh_client()
    valid = 0.5

    # Testar cada campo individualmente com valor inválido
    for payload in [
        {"engram_hit_rate": invalid_value, "vector_hit_rate": valid, "federated_hit_rate": valid},
        {"engram_hit_rate": valid, "vector_hit_rate": invalid_value, "federated_hit_rate": valid},
        {"engram_hit_rate": valid, "vector_hit_rate": valid, "federated_hit_rate": invalid_value},
    ]:
        resp = client.post("/stats/client-metrics", json=payload)
        assert resp.status_code == 422, (
            f"Esperado 422 para payload {payload}, obteve {resp.status_code}"
        )
