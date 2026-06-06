"""
Tests for GS-007: /ready (DB readiness probe) and /metrics (Prometheus text).
"""

from app.api.observability import MetricsCollector, _normalize
from app.db import get_db
from app.main import app

# ─────────────────────────────────────────────────────────────────────────────
# Unit — path normalization
# ─────────────────────────────────────────────────────────────────────────────

def test_normalize_replaces_id_segments():
    assert _normalize("/api/v1/emergency/admin/42/status") == "/api/v1/emergency/admin/{id}/status"


def test_normalize_preserves_non_digit_segments():
    assert _normalize("/api/v1/warehouses") == "/api/v1/warehouses"


def test_normalize_multiple_ids():
    assert _normalize("/a/1/b/2/c") == "/a/{id}/b/{id}/c"


# ─────────────────────────────────────────────────────────────────────────────
# Unit — MetricsCollector
# ─────────────────────────────────────────────────────────────────────────────

def test_collector_counts_requests():
    c = MetricsCollector()
    c.record("GET", "/api/v1/warehouses", 200, 0.01)
    c.record("GET", "/api/v1/warehouses", 200, 0.02)
    c.record("POST", "/api/v1/emergency", 201, 0.05)

    text = c.prometheus_text()
    assert 'http_requests_total{method="GET",path="/api/v1/warehouses",status="200"} 2' in text
    assert 'http_requests_total{method="POST",path="/api/v1/emergency",status="201"} 1' in text


def test_collector_sums_duration():
    c = MetricsCollector()
    c.record("GET", "/health", 200, 0.01)
    c.record("GET", "/health", 200, 0.03)

    text = c.prometheus_text()
    assert 'http_request_duration_seconds_count{method="GET",path="/health"} 2' in text
    # Sum should be 0.04 ± float epsilon
    import re
    match = re.search(
        r'http_request_duration_seconds_sum\{method="GET",path="/health"\} ([0-9.]+)', text
    )
    assert match and abs(float(match.group(1)) - 0.04) < 1e-9


def test_collector_prometheus_text_has_required_headers():
    c = MetricsCollector()
    c.record("GET", "/health", 200, 0.001)
    text = c.prometheus_text()
    assert "# HELP http_requests_total" in text
    assert "# TYPE http_requests_total counter" in text
    assert "# HELP http_request_duration_seconds_sum" in text
    assert "# HELP http_request_duration_seconds_count" in text


# ─────────────────────────────────────────────────────────────────────────────
# Integration — /ready
# ─────────────────────────────────────────────────────────────────────────────

def test_ready_returns_200_when_db_reachable(client):
    res = client.get("/ready")
    assert res.status_code == 200
    assert res.json()["data"]["ready"] is True


def test_ready_returns_503_when_db_unreachable(client):
    async def _broken_db():
        raise Exception("connection refused")
        yield  # make it a generator

    original = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _broken_db
    try:
        res = client.get("/ready")
        assert res.status_code == 503
    finally:
        if original is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = original


# ─────────────────────────────────────────────────────────────────────────────
# Integration — /metrics
# ─────────────────────────────────────────────────────────────────────────────

def test_metrics_returns_200(client):
    res = client.get("/metrics")
    assert res.status_code == 200


def test_metrics_content_type_is_prometheus(client):
    res = client.get("/metrics")
    assert "text/plain" in res.headers["content-type"]


def test_metrics_contains_prometheus_lines(client):
    client.get("/health")
    res = client.get("/metrics")
    body = res.text
    assert "http_requests_total" in body
    assert "http_request_duration_seconds_sum" in body


def test_metrics_count_increments_after_request(client):
    import re
    client.get("/health")
    res = client.get("/metrics")

    matches = re.findall(
        r'http_requests_total\{[^}]+path="/health"[^}]*\} (\d+)', res.text
    )
    assert matches, "Expected /health counter in /metrics output"
    assert int(matches[0]) >= 1


# ─────────────────────────────────────────────────────────────────────────────
# Integration — /health (liveness — must not touch DB)
# ─────────────────────────────────────────────────────────────────────────────

def test_health_returns_200_without_db(client):
    async def _broken_db():
        raise Exception("should not be called")
        yield

    original = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _broken_db
    try:
        res = client.get("/health")
        assert res.status_code == 200
    finally:
        if original is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = original
