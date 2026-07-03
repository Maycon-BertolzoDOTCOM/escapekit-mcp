"""
Tests for validation cache metrics in ClientMetricsRequest and StatsResponse.

# Feature: validation-result-cache

Property tests:
  P_VM1: ClientMetricsRequest aceita campos de validação opcionais e os preserva
  P_VM2: GET /stats retorna campos de validação corretos após POST /stats/client-metrics
"""

import pytest
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

import main as server_module
from main import ClientMetricsRequest, _InMemoryStore, app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fresh_client() -> TestClient:
    """Return a TestClient backed by a fresh in-memory store."""
    server_module._store = _InMemoryStore()
    server_module._client_metrics = None
    return TestClient(app)


# ---------------------------------------------------------------------------
# P_VM1: ClientMetricsRequest aceita campos de validação opcionais e os preserva
# Feature: validation-result-cache
# Validates: Requirement 3.5
# ---------------------------------------------------------------------------


@given(
    hits=st.integers(min_value=0),
    misses=st.integers(min_value=0),
    avg_time=st.floats(min_value=0.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p_vm1_client_metrics_request_accepts_validation_fields(hits, misses, avg_time):
    """
    **Validates: Requirements 3.5**

    # Feature: validation-result-cache, Property P_VM1
    ClientMetricsRequest aceita os campos de validação opcionais e os preserva corretamente.
    """
    payload = ClientMetricsRequest(
        engram_hit_rate=0.5,
        vector_hit_rate=0.5,
        federated_hit_rate=0.5,
        validation_cache_hits=hits,
        validation_cache_misses=misses,
        avg_validation_time_ms=avg_time,
    )
    assert payload.validation_cache_hits == hits
    assert payload.validation_cache_misses == misses
    assert payload.avg_validation_time_ms == avg_time


def test_client_metrics_request_defaults_to_zero():
    """
    ClientMetricsRequest sem campos de validação usa defaults 0.
    """
    payload = ClientMetricsRequest(
        engram_hit_rate=0.5,
        vector_hit_rate=0.5,
        federated_hit_rate=0.5,
    )
    assert payload.validation_cache_hits == 0
    assert payload.validation_cache_misses == 0
    assert payload.avg_validation_time_ms == 0.0


# ---------------------------------------------------------------------------
# P_VM2: GET /stats retorna campos de validação corretos após POST /stats/client-metrics
# Feature: validation-result-cache
# Validates: Requirement 3.1, 3.5
# ---------------------------------------------------------------------------


@given(
    hits=st.integers(min_value=0, max_value=10_000),
    misses=st.integers(min_value=0, max_value=10_000),
    avg_time=st.floats(min_value=0.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_p_vm2_stats_returns_validation_metrics_after_post(hits, misses, avg_time):
    """
    **Validates: Requirements 3.1, 3.5**

    # Feature: validation-result-cache, Property P_VM2
    GET /stats retorna os campos de validação com os valores corretos após
    POST /stats/client-metrics com esses campos.
    """
    client = _fresh_client()

    resp = client.post("/stats/client-metrics", json={
        "engram_hit_rate": 0.5,
        "vector_hit_rate": 0.5,
        "federated_hit_rate": 0.5,
        "validation_cache_hits": hits,
        "validation_cache_misses": misses,
        "avg_validation_time_ms": avg_time,
    })
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    stats_resp = client.get("/stats")
    assert stats_resp.status_code == 200
    data = stats_resp.json()

    assert data["client_validation_cache_hits"] == hits
    assert data["client_validation_cache_misses"] == misses
    assert data["client_avg_validation_time_ms"] == pytest.approx(avg_time)


def test_stats_returns_zero_validation_metrics_when_no_client_metrics():
    """
    GET /stats retorna zeros para campos de validação quando nenhum
    POST /stats/client-metrics foi feito.
    """
    client = _fresh_client()

    resp = client.get("/stats")
    assert resp.status_code == 200
    data = resp.json()

    assert data["client_validation_cache_hits"] == 0
    assert data["client_validation_cache_misses"] == 0
    assert data["client_avg_validation_time_ms"] == 0.0
