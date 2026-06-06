"""
Tests for announcement endpoints (Sprint 3) and emergency terminal-state hardening.
"""

from app.api.auth import get_current_user
from app.api.rate_limit import emergency_limiter
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


_CREATE_PAYLOAD = {
    "title": "Test Duyurusu",
    "content": "Bu bir test duyurusudur.",
    "kategori": "genel",
    "priority": "normal",
}

_EMERGENCY_PAYLOAD = {
    "durum": "Test Alarm",
    "saat": "2026-05-21 10:00",
    "harita_link": "https://maps.example.com",
    "enlem": 41.01,
    "boylam": 29.01,
}


# ─────────────────────────────────────────────────────────────────────────────
# Announcement — public list
# ─────────────────────────────────────────────────────────────────────────────

def test_announcement_public_list_shows_only_published(client):
    """Public GET must return only published announcements, not drafts."""
    draft_res = client.post("/api/v1/announcements", json=_CREATE_PAYLOAD)
    assert draft_res.status_code == 201
    draft_id = draft_res.json()["data"]["id"]

    pub_res = client.post("/api/v1/announcements", json={**_CREATE_PAYLOAD, "title": "Published"})
    assert pub_res.status_code == 201
    pub_id = pub_res.json()["data"]["id"]

    # Publish the second one
    client.patch(f"/api/v1/announcements/{pub_id}", json={"status": "published"})

    list_res = client.get("/api/v1/announcements")
    assert list_res.status_code == 200
    ids = [a["id"] for a in list_res.json()["data"]]
    assert pub_id in ids
    assert draft_id not in ids


def test_announcement_public_list_category_filter(client):
    """Public GET accepts ?kategori= filter."""
    saglik_res = client.post("/api/v1/announcements", json={**_CREATE_PAYLOAD, "kategori": "saglik"})
    saglik_id = saglik_res.json()["data"]["id"]
    client.patch(f"/api/v1/announcements/{saglik_id}", json={"status": "published"})

    uyari_res = client.post("/api/v1/announcements", json={**_CREATE_PAYLOAD, "kategori": "uyari"})
    uyari_id = uyari_res.json()["data"]["id"]
    client.patch(f"/api/v1/announcements/{uyari_id}", json={"status": "published"})

    res = client.get("/api/v1/announcements?kategori=saglik")
    assert res.status_code == 200
    ids = [a["id"] for a in res.json()["data"]]
    assert saglik_id in ids
    assert uyari_id not in ids


# ─────────────────────────────────────────────────────────────────────────────
# Announcement — admin auth
# ─────────────────────────────────────────────────────────────────────────────

def test_announcement_admin_list_requires_admin(client):
    """Viewer role must be rejected from admin list endpoint."""
    res = _with_viewer(client, lambda: client.get("/api/v1/announcements/admin"))
    assert res.status_code == 403


def test_announcement_create_requires_admin(client):
    """Viewer role must be rejected from create endpoint."""
    res = _with_viewer(client, lambda: client.post("/api/v1/announcements", json=_CREATE_PAYLOAD))
    assert res.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Announcement — create
# ─────────────────────────────────────────────────────────────────────────────

def test_announcement_create_sets_draft_status(client):
    """Newly created announcement must default to draft status."""
    res = client.post("/api/v1/announcements", json=_CREATE_PAYLOAD)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["status"] == "draft"
    assert data["published_at"] is None


def test_announcement_publish_sets_published_at(client):
    """Changing status to 'published' must set published_at timestamp."""
    create_res = client.post("/api/v1/announcements", json=_CREATE_PAYLOAD)
    assert create_res.status_code == 201
    ann_id = create_res.json()["data"]["id"]

    patch_res = client.patch(f"/api/v1/announcements/{ann_id}", json={"status": "published"})
    assert patch_res.status_code == 200
    data = patch_res.json()["data"]
    assert data["status"] == "published"
    assert data["published_at"] is not None


def test_announcement_publish_at_set_only_once(client):
    """published_at must not be overwritten if already set."""
    create_res = client.post("/api/v1/announcements", json=_CREATE_PAYLOAD)
    ann_id = create_res.json()["data"]["id"]

    client.patch(f"/api/v1/announcements/{ann_id}", json={"status": "published"})
    first_published_at = client.get("/api/v1/announcements/admin").json()["data"][0]["published_at"]

    # Archive then re-publish
    client.patch(f"/api/v1/announcements/{ann_id}", json={"status": "archived"})
    client.patch(f"/api/v1/announcements/{ann_id}", json={"status": "published"})

    second_published_at = client.get("/api/v1/announcements/admin").json()["data"][0]["published_at"]
    assert first_published_at == second_published_at


# ─────────────────────────────────────────────────────────────────────────────
# Announcement — validation
# ─────────────────────────────────────────────────────────────────────────────

def test_announcement_invalid_kategori_rejected(client):
    """Unknown category value must return 422."""
    res = client.post("/api/v1/announcements", json={**_CREATE_PAYLOAD, "kategori": "unknown_cat"})
    assert res.status_code == 422


def test_announcement_invalid_priority_rejected(client):
    """Unknown priority value must return 422."""
    res = client.post("/api/v1/announcements", json={**_CREATE_PAYLOAD, "priority": "urgent"})
    assert res.status_code == 422


def test_announcement_invalid_status_update_rejected(client):
    """Unknown status value in PATCH must return 422."""
    create_res = client.post("/api/v1/announcements", json=_CREATE_PAYLOAD)
    ann_id = create_res.json()["data"]["id"]
    res = client.patch(f"/api/v1/announcements/{ann_id}", json={"status": "unknown_status"})
    assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Announcement — delete
# ─────────────────────────────────────────────────────────────────────────────

def test_announcement_delete_removes_record(client):
    """DELETE must remove the announcement; subsequent GET returns 404."""
    create_res = client.post("/api/v1/announcements", json=_CREATE_PAYLOAD)
    ann_id = create_res.json()["data"]["id"]

    del_res = client.delete(f"/api/v1/announcements/{ann_id}")
    assert del_res.status_code == 200

    not_found = client.delete(f"/api/v1/announcements/{ann_id}")
    assert not_found.status_code == 404


def test_announcement_admin_list_status_filter(client):
    """Admin list endpoint filters by status correctly."""
    draft_res = client.post("/api/v1/announcements", json=_CREATE_PAYLOAD)
    draft_id = draft_res.json()["data"]["id"]

    pub_res = client.post("/api/v1/announcements", json={**_CREATE_PAYLOAD, "title": "Pub"})
    pub_id = pub_res.json()["data"]["id"]
    client.patch(f"/api/v1/announcements/{pub_id}", json={"status": "published"})

    draft_list = client.get("/api/v1/announcements/admin?status=draft").json()["data"]
    assert any(a["id"] == draft_id for a in draft_list)
    assert not any(a["id"] == pub_id for a in draft_list)

    pub_list = client.get("/api/v1/announcements/admin?status=published").json()["data"]
    assert any(a["id"] == pub_id for a in pub_list)
    assert not any(a["id"] == draft_id for a in pub_list)


# ─────────────────────────────────────────────────────────────────────────────
# Emergency — terminal state hardening (Sprint 3)
# ─────────────────────────────────────────────────────────────────────────────

def test_emergency_terminal_status_cannot_reopen(client):
    """A report marked as 'spam' cannot be moved back to 'new' (422)."""
    emergency_limiter._buckets.clear()
    create_res = client.post("/api/v1/emergency", json=_EMERGENCY_PAYLOAD)
    em_id = create_res.json()["data"]["id"]

    # Mark as spam
    client.patch(f"/api/v1/emergency/admin/{em_id}/status", json={"status": "spam"})

    # Attempt to reopen
    reopen_res = client.patch(
        f"/api/v1/emergency/admin/{em_id}/status",
        json={"status": "new"},
    )
    assert reopen_res.status_code == 422


def test_emergency_terminal_dismissed_cannot_reopen(client):
    """A report marked as 'dismissed' cannot be moved back to 'reviewing' (422)."""
    emergency_limiter._buckets.clear()
    create_res = client.post("/api/v1/emergency", json=_EMERGENCY_PAYLOAD)
    em_id = create_res.json()["data"]["id"]

    client.patch(f"/api/v1/emergency/admin/{em_id}/status", json={"status": "dismissed"})

    reopen_res = client.patch(
        f"/api/v1/emergency/admin/{em_id}/status",
        json={"status": "reviewing"},
    )
    assert reopen_res.status_code == 422


def test_emergency_terminal_swap_allowed(client):
    """spam→dismissed and dismissed→spam swaps are permitted (200)."""
    emergency_limiter._buckets.clear()
    create_res = client.post("/api/v1/emergency", json=_EMERGENCY_PAYLOAD)
    em_id = create_res.json()["data"]["id"]

    client.patch(f"/api/v1/emergency/admin/{em_id}/status", json={"status": "spam"})

    swap_res = client.patch(
        f"/api/v1/emergency/admin/{em_id}/status",
        json={"status": "dismissed"},
    )
    assert swap_res.status_code == 200
    assert swap_res.json()["data"]["status"] == "dismissed"
