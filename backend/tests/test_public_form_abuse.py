"""
Tests for GS-017: public-form abuse protection.
Covers rate limiting on volunteer and shelter-offer endpoints,
duplicate-submission suppression, and admin abuse-metrics endpoint.
"""

import pytest
from app.api.rate_limit import volunteer_limiter, shelter_limiter, emergency_limiter, public_form_dedup


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures / helpers
# ─────────────────────────────────────────────────────────────────────────────

def _reset_limiters():
    volunteer_limiter._buckets.clear()
    shelter_limiter._buckets.clear()
    emergency_limiter._buckets.clear()
    public_form_dedup._seen.clear()


def _volunteer(suffix=""):
    return {
        "full_name": f"Test User{suffix}",
        "contact_info": "test@example.com",
        "skills": ["first_aid"],
    }


def _shelter(suffix=""):
    return {
        "host_name": f"Test Host{suffix}",
        "contact_info": "host@example.com",
        "capacity": 2,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Volunteer rate limiting
# ─────────────────────────────────────────────────────────────────────────────

def test_volunteer_rate_limited(client):
    _reset_limiters()
    for i in range(volunteer_limiter.max_requests):
        res = client.post("/api/v1/volunteers", json=_volunteer(f" {i}"))
        assert res.status_code == 201

    blocked = client.post("/api/v1/volunteers", json=_volunteer(" extra"))
    assert blocked.status_code == 429


def test_volunteer_rate_limit_blocks_count_increments(client):
    _reset_limiters()
    before = volunteer_limiter.blocked_count
    for i in range(volunteer_limiter.max_requests):
        client.post("/api/v1/volunteers", json=_volunteer(f" {i}"))
    client.post("/api/v1/volunteers", json=_volunteer(" extra"))

    assert volunteer_limiter.blocked_count == before + 1


# ─────────────────────────────────────────────────────────────────────────────
# Shelter-offer rate limiting
# ─────────────────────────────────────────────────────────────────────────────

def test_shelter_offer_rate_limited(client):
    _reset_limiters()
    for i in range(shelter_limiter.max_requests):
        res = client.post("/api/v1/shelter-offers", json=_shelter(f" {i}"))
        assert res.status_code == 201

    blocked = client.post("/api/v1/shelter-offers", json=_shelter(" extra"))
    assert blocked.status_code == 429


def test_shelter_rate_limit_blocks_count_increments(client):
    _reset_limiters()
    before = shelter_limiter.blocked_count
    for i in range(shelter_limiter.max_requests):
        client.post("/api/v1/shelter-offers", json=_shelter(f" {i}"))
    client.post("/api/v1/shelter-offers", json=_shelter(" extra"))

    assert shelter_limiter.blocked_count == before + 1


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate-submission suppression — volunteers
# ─────────────────────────────────────────────────────────────────────────────

def test_volunteer_duplicate_rejected(client):
    _reset_limiters()
    payload = _volunteer()
    first = client.post("/api/v1/volunteers", json=payload)
    assert first.status_code == 201

    duplicate = client.post("/api/v1/volunteers", json=payload)
    assert duplicate.status_code == 409


def test_volunteer_different_content_accepted(client):
    _reset_limiters()
    first = client.post("/api/v1/volunteers", json=_volunteer(" A"))
    assert first.status_code == 201

    second = client.post("/api/v1/volunteers", json=_volunteer(" B"))
    assert second.status_code == 201


def test_volunteer_duplicate_increments_rejected_count(client):
    _reset_limiters()
    before = public_form_dedup.rejected_count
    payload = _volunteer()
    client.post("/api/v1/volunteers", json=payload)
    client.post("/api/v1/volunteers", json=payload)

    assert public_form_dedup.rejected_count == before + 1


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate-submission suppression — shelter offers
# ─────────────────────────────────────────────────────────────────────────────

def test_shelter_duplicate_rejected(client):
    _reset_limiters()
    payload = _shelter()
    first = client.post("/api/v1/shelter-offers", json=payload)
    assert first.status_code == 201

    duplicate = client.post("/api/v1/shelter-offers", json=payload)
    assert duplicate.status_code == 409


def test_shelter_different_content_accepted(client):
    _reset_limiters()
    first = client.post("/api/v1/shelter-offers", json=_shelter(" A"))
    assert first.status_code == 201

    second = client.post("/api/v1/shelter-offers", json=_shelter(" B"))
    assert second.status_code == 201


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate-submission suppression — emergency (existing endpoint)
# ─────────────────────────────────────────────────────────────────────────────

def test_emergency_duplicate_rejected(client):
    _reset_limiters()
    payload = {
        "durum": "Test",
        "saat": "2026-05-30 10:00",
        "harita_link": "https://maps.example.com",
        "enlem": 41.01,
        "boylam": 29.01,
    }
    first = client.post("/api/v1/emergency", json=payload)
    assert first.status_code == 201

    duplicate = client.post("/api/v1/emergency", json=payload)
    assert duplicate.status_code == 409


# ─────────────────────────────────────────────────────────────────────────────
# Admin abuse-metrics endpoint
# ─────────────────────────────────────────────────────────────────────────────

def test_abuse_metrics_requires_admin(client):
    from app.api.auth import get_current_user
    from app.main import app
    from app.models.user import User

    async def viewer():
        return User(id=2, name="Viewer", email="viewer@test.local", role="viewer")

    original = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = viewer
    try:
        res = client.get("/api/v1/admin/abuse-metrics")
        assert res.status_code == 403
    finally:
        if original is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original


def test_abuse_metrics_returns_expected_shape(client):
    res = client.get("/api/v1/admin/abuse-metrics")
    assert res.status_code == 200

    data = res.json()["data"]
    assert "rate_limit_blocks" in data
    assert "duplicate_rejections" in data
    blocks = data["rate_limit_blocks"]
    assert "emergency" in blocks
    assert "volunteers" in blocks
    assert "shelter_offers" in blocks


def test_abuse_metrics_reflect_blocks(client):
    _reset_limiters()
    before_blocks = volunteer_limiter.blocked_count
    before_dups = public_form_dedup.rejected_count

    # Exhaust volunteer limit then trigger one block
    for i in range(volunteer_limiter.max_requests):
        client.post("/api/v1/volunteers", json=_volunteer(f" {i}"))
    client.post("/api/v1/volunteers", json=_volunteer(" x"))  # 429

    # Trigger one dedup rejection on shelter
    payload = _shelter()
    client.post("/api/v1/shelter-offers", json=payload)  # 201
    client.post("/api/v1/shelter-offers", json=payload)  # 409

    res = client.get("/api/v1/admin/abuse-metrics")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["rate_limit_blocks"]["volunteers"] >= before_blocks + 1
    assert data["duplicate_rejections"] >= before_dups + 1
