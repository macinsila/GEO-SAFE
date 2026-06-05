"""
Tests for GS-111: neighborhood/area channels + moderation.

The test client's current user is a fixed admin (id=1), so membership/mute
paths are exercised against that user.
"""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture(autouse=True)
def reset_channel_limiter():
    """Channel send limiter is module-level; clear it between tests."""
    from app.api.channels import channel_message_limiter
    channel_message_limiter._buckets.clear()
    yield
    channel_message_limiter._buckets.clear()


def _create_channel(client, slug="kadikoy", name="Kadıköy", lat=40.99, lon=29.03, radius=5.0):
    return client.post(
        "/api/v1/channels",
        json={"slug": slug, "name": name, "center_lat": lat, "center_lon": lon, "radius_km": radius},
    )


# ── Channel CRUD ─────────────────────────────────────────────────────────────

def test_create_channel(client):
    res = _create_channel(client)
    assert res.status_code == 201
    assert res.json()["data"]["slug"] == "kadikoy"


def test_create_duplicate_slug_rejected(client):
    _create_channel(client)
    res = _create_channel(client)
    assert res.status_code == 409


def test_create_invalid_slug_rejected(client):
    res = client.post(
        "/api/v1/channels",
        json={"slug": "Bad Slug!", "name": "x"},
    )
    assert res.status_code == 422


def test_list_channels_with_distance_and_suggested(client):
    _create_channel(client, slug="near", lat=41.0082, lon=28.9784, radius=10)
    _create_channel(client, slug="far", lat=39.9, lon=32.85, radius=5)
    res = client.get("/api/v1/channels?lat=41.0150&lon=28.9784")
    assert res.status_code == 200
    items = res.json()["data"]
    by_slug = {c["slug"]: c for c in items}
    assert by_slug["near"]["suggested"] is True
    assert by_slug["far"]["suggested"] is False
    # nearest first
    assert items[0]["slug"] == "near"


# ── Join / leave ─────────────────────────────────────────────────────────────

def test_join_and_leave(client):
    _create_channel(client)
    join = client.post("/api/v1/channels/kadikoy/join")
    assert join.status_code == 200
    assert join.json()["data"]["joined"] is True

    listed = client.get("/api/v1/channels").json()["data"]
    assert any(c["slug"] == "kadikoy" and c["joined"] for c in listed)

    leave = client.post("/api/v1/channels/kadikoy/leave")
    assert leave.status_code == 200
    listed = client.get("/api/v1/channels").json()["data"]
    assert all(not c["joined"] for c in listed if c["slug"] == "kadikoy")


def test_join_nonexistent_channel_404(client):
    res = client.post("/api/v1/channels/nope/join")
    assert res.status_code == 404


# ── Messages ─────────────────────────────────────────────────────────────────

def test_send_requires_membership(client):
    _create_channel(client)
    res = client.post("/api/v1/channels/kadikoy/messages", json={"body": "Merhaba"})
    assert res.status_code == 403


def test_send_and_history(client):
    _create_channel(client)
    client.post("/api/v1/channels/kadikoy/join")
    with patch("app.api.channels.broadcast_chat_message", new=AsyncMock()):
        res = client.post("/api/v1/channels/kadikoy/messages", json={"body": "Mahalle selam"})
    assert res.status_code == 201

    history = client.get("/api/v1/channels/kadikoy/messages").json()["data"]
    assert len(history) == 1
    assert history[0]["body"] == "Mahalle selam"
    assert history[0]["room"] == "kadikoy"


def test_send_broadcasts_via_sse(client):
    _create_channel(client)
    client.post("/api/v1/channels/kadikoy/join")
    broadcast = AsyncMock()
    with patch("app.api.channels.broadcast_chat_message", new=broadcast):
        client.post("/api/v1/channels/kadikoy/messages", json={"body": "yayın"})
    broadcast.assert_awaited_once()


def test_send_rate_limited(client):
    _create_channel(client)
    client.post("/api/v1/channels/kadikoy/join")
    with patch("app.api.channels.broadcast_chat_message", new=AsyncMock()):
        codes = [
            client.post("/api/v1/channels/kadikoy/messages", json={"body": f"m{i}"}).status_code
            for i in range(12)
        ]
    assert codes.count(201) == 10
    assert 429 in codes


# ── Moderation ───────────────────────────────────────────────────────────────

def test_report_message(client):
    _create_channel(client)
    client.post("/api/v1/channels/kadikoy/join")
    with patch("app.api.channels.broadcast_chat_message", new=AsyncMock()):
        msg = client.post("/api/v1/channels/kadikoy/messages", json={"body": "şüpheli"}).json()["data"]
    res = client.post(
        f"/api/v1/channels/messages/{msg['id']}/report",
        json={"reason": "spam"},
    )
    assert res.status_code == 201


def test_remove_message_hides_from_history(client):
    _create_channel(client)
    client.post("/api/v1/channels/kadikoy/join")
    with patch("app.api.channels.broadcast_chat_message", new=AsyncMock()):
        msg = client.post("/api/v1/channels/kadikoy/messages", json={"body": "kaldırılacak"}).json()["data"]

    rem = client.delete(f"/api/v1/channels/messages/{msg['id']}")
    assert rem.status_code == 200
    history = client.get("/api/v1/channels/kadikoy/messages").json()["data"]
    assert all(m["id"] != msg["id"] for m in history)


def test_mute_blocks_sending(client):
    _create_channel(client)
    client.post("/api/v1/channels/kadikoy/join")
    # admin mutes themselves (user id=1) for the test
    mute = client.post("/api/v1/channels/kadikoy/members/1/mute")
    assert mute.status_code == 200

    res = client.post("/api/v1/channels/kadikoy/messages", json={"body": "engellenecek"})
    assert res.status_code == 403

    client.post("/api/v1/channels/kadikoy/members/1/unmute")
    with patch("app.api.channels.broadcast_chat_message", new=AsyncMock()):
        ok = client.post("/api/v1/channels/kadikoy/messages", json={"body": "artık olur"})
    assert ok.status_code == 201


def test_mute_unknown_member_404(client):
    _create_channel(client)
    res = client.post("/api/v1/channels/kadikoy/members/999/mute")
    assert res.status_code == 404
