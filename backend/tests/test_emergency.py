"""
Tests for emergency report endpoints.
Covers Sprint 1 (create, rate limit, admin list security) and
Sprint 3A (status field, status filter, status update, admin-only enforcement).
"""

from app.api.rate_limit import emergency_limiter
from app.api.auth import get_current_user
from app.main import app
from app.models.user import User


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _override_viewer():
    async def _inner():
        return User(id=2, name="Viewer", email="viewer@test.local", role="viewer")
    return _inner


def _with_viewer(client, call_fn):
    original = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = _override_viewer()
    try:
        return call_fn()
    finally:
        if original is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original


_PAYLOAD = {
    "durum": "Test Alarm",
    "saat": "2026-05-06 10:00",
    "harita_link": "https://maps.example.com",
    "enlem": 41.01,
    "boylam": 29.01,
}


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 1 — Public create
# ─────────────────────────────────────────────────────────────────────────────

def test_emergency_reports_persist(client):
    emergency_limiter._buckets.clear()
    create_res = client.post("/api/v1/emergency", json=_PAYLOAD)
    assert create_res.status_code == 201

    list_res = client.get("/api/v1/emergency")
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["status"] == "success"
    assert body["data"]


def test_emergency_rate_limited(client):
    emergency_limiter._buckets.clear()
    payload = {**_PAYLOAD, "durum": "Rate Limit Test"}

    for _ in range(emergency_limiter.max_requests):
        response = client.post("/api/v1/emergency", json=payload)
        assert response.status_code == 201

    blocked = client.post("/api/v1/emergency", json=payload)
    assert blocked.status_code == 429


def test_emergency_list_requires_admin_role(client):
    response = _with_viewer(client, lambda: client.get("/api/v1/emergency"))
    assert response.status_code == 403


def test_emergency_delete_requires_admin_role(client):
    response = _with_viewer(client, lambda: client.delete("/api/v1/emergency"))
    assert response.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 3A — Public create response is minimal (no false confidence)
# ─────────────────────────────────────────────────────────────────────────────

def test_emergency_public_create_response_is_minimal(client):
    """Public create response must only contain {id} — no status, no misleading fields."""
    emergency_limiter._buckets.clear()
    create_res = client.post("/api/v1/emergency", json=_PAYLOAD)
    assert create_res.status_code == 201

    data = create_res.json()["data"]
    assert "id" in data
    # Must NOT expose status or moderation-related info to the public sender
    assert "status" not in data
    assert "durum" not in data


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 3A — Emergency status field exists and defaults to 'new'
# ─────────────────────────────────────────────────────────────────────────────

def test_emergency_status_field_defaults_to_new(client):
    """Admin list must show status='new' for freshly submitted reports."""
    emergency_limiter._buckets.clear()
    client.post("/api/v1/emergency", json=_PAYLOAD)

    list_res = client.get("/api/v1/emergency")
    assert list_res.status_code == 200
    reports = list_res.json()["data"]
    assert reports
    assert reports[0]["status"] == "new"


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 3A — Emergency status filter
# ─────────────────────────────────────────────────────────────────────────────

def test_emergency_status_filter_works(client):
    """Admin can filter emergency list by status."""
    emergency_limiter._buckets.clear()

    r1 = client.post("/api/v1/emergency", json={**_PAYLOAD, "durum": "Em A"})
    r2 = client.post("/api/v1/emergency", json={**_PAYLOAD, "durum": "Em B"})
    assert r1.status_code == 201
    assert r2.status_code == 201
    em_a_id = r1.json()["data"]["id"]

    # Move em_a to 'resolved'
    patch_res = client.patch(
        f"/api/v1/emergency/admin/{em_a_id}/status",
        json={"status": "resolved"},
    )
    assert patch_res.status_code == 200

    # Filter new → em_a should not appear
    new_res = client.get("/api/v1/emergency?status=new")
    assert new_res.status_code == 200
    new_ids = [e["id"] for e in new_res.json()["data"]]
    assert em_a_id not in new_ids

    # Filter resolved → em_a should appear
    resolved_res = client.get("/api/v1/emergency?status=resolved")
    assert resolved_res.status_code == 200
    resolved_ids = [e["id"] for e in resolved_res.json()["data"]]
    assert em_a_id in resolved_ids


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 3A — Emergency status update
# ─────────────────────────────────────────────────────────────────────────────

def test_emergency_admin_status_update_works(client):
    """Admin can cycle through all emergency statuses."""
    emergency_limiter._buckets.clear()
    create_res = client.post("/api/v1/emergency", json=_PAYLOAD)
    assert create_res.status_code == 201
    em_id = create_res.json()["data"]["id"]

    # Cycle through forward-flow statuses; spam/dismissed are terminal (no return to new)
    for new_status in ("reviewing", "resolved", "dismissed", "spam"):
        patch_res = client.patch(
            f"/api/v1/emergency/admin/{em_id}/status",
            json={"status": new_status},
        )
        assert patch_res.status_code == 200, f"Expected 200 for status={new_status}"
        assert patch_res.json()["data"]["status"] == new_status


def test_emergency_admin_status_update_forbidden_for_non_admin(client):
    """Non-admin (viewer) cannot update emergency status."""
    emergency_limiter._buckets.clear()
    create_res = client.post("/api/v1/emergency", json=_PAYLOAD)
    assert create_res.status_code == 201
    em_id = create_res.json()["data"]["id"]

    response = _with_viewer(
        client,
        lambda: client.patch(
            f"/api/v1/emergency/admin/{em_id}/status",
            json={"status": "resolved"},
        ),
    )
    assert response.status_code == 403


def test_emergency_admin_status_update_invalid_status_rejected(client):
    """Invalid status value returns 422."""
    emergency_limiter._buckets.clear()
    create_res = client.post("/api/v1/emergency", json=_PAYLOAD)
    assert create_res.status_code == 201
    em_id = create_res.json()["data"]["id"]

    patch_res = client.patch(
        f"/api/v1/emergency/admin/{em_id}/status",
        json={"status": "deleted"},
    )
    assert patch_res.status_code == 422


def test_emergency_admin_status_update_not_found(client):
    """PATCH on non-existent ID returns 404."""
    emergency_limiter._buckets.clear()
    patch_res = client.patch(
        "/api/v1/emergency/admin/999999/status",
        json={"status": "resolved"},
    )
    assert patch_res.status_code == 404
