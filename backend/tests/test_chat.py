"""
Tests for GS-110: ops chat messages (send + history + SSE broadcast).
"""

from unittest.mock import AsyncMock, patch

# ─────────────────────────────────────────────────────────────────────────────
# Happy path
# ─────────────────────────────────────────────────────────────────────────────

def test_send_message(client):
    with patch("app.api.chat.broadcast_chat_message", new=AsyncMock()):
        res = client.post("/api/v1/chat/messages", json={"body": "Merhaba dünya"})
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["body"] == "Merhaba dünya"
    assert data["room"] == "ops"
    assert data["user_name"] == "Test Admin"


def test_send_message_custom_room(client):
    with patch("app.api.chat.broadcast_chat_message", new=AsyncMock()):
        res = client.post("/api/v1/chat/messages", json={"body": "Saha raporu", "room": "field"})
    assert res.status_code == 201
    assert res.json()["data"]["room"] == "field"


def test_send_message_broadcasts_via_sse(client):
    broadcast_mock = AsyncMock()
    with patch("app.api.chat.broadcast_chat_message", new=broadcast_mock):
        client.post("/api/v1/chat/messages", json={"body": "Test broadcast"})
    broadcast_mock.assert_awaited_once()
    payload = broadcast_mock.call_args[0][0]
    assert payload["body"] == "Test broadcast"


def test_get_messages_empty(client):
    res = client.get("/api/v1/chat/messages?room=ops")
    assert res.status_code == 200
    assert res.json()["data"] == []


def test_get_messages_returns_history(client):
    with patch("app.api.chat.broadcast_chat_message", new=AsyncMock()):
        client.post("/api/v1/chat/messages", json={"body": "Mesaj 1"})
        client.post("/api/v1/chat/messages", json={"body": "Mesaj 2"})

    res = client.get("/api/v1/chat/messages?room=ops")
    assert res.status_code == 200
    messages = res.json()["data"]
    assert len(messages) == 2
    # Oldest first
    assert messages[0]["body"] == "Mesaj 1"
    assert messages[1]["body"] == "Mesaj 2"


def test_get_messages_room_isolation(client):
    with patch("app.api.chat.broadcast_chat_message", new=AsyncMock()):
        client.post("/api/v1/chat/messages", json={"body": "Ops mesajı", "room": "ops"})
        client.post("/api/v1/chat/messages", json={"body": "Field mesajı", "room": "field"})

    ops_msgs = client.get("/api/v1/chat/messages?room=ops").json()["data"]
    field_msgs = client.get("/api/v1/chat/messages?room=field").json()["data"]

    assert len(ops_msgs) == 1
    assert ops_msgs[0]["body"] == "Ops mesajı"
    assert len(field_msgs) == 1
    assert field_msgs[0]["body"] == "Field mesajı"


def test_get_messages_respects_limit(client):
    with patch("app.api.chat.broadcast_chat_message", new=AsyncMock()):
        for i in range(5):
            client.post("/api/v1/chat/messages", json={"body": f"Msg {i}"})

    res = client.get("/api/v1/chat/messages?room=ops&limit=3")
    assert res.status_code == 200
    assert len(res.json()["data"]) == 3


# ─────────────────────────────────────────────────────────────────────────────
# Validation failures
# ─────────────────────────────────────────────────────────────────────────────

def test_send_empty_body_rejected(client):
    res = client.post("/api/v1/chat/messages", json={"body": ""})
    assert res.status_code == 422


def test_send_body_too_long_rejected(client):
    res = client.post("/api/v1/chat/messages", json={"body": "x" * 1001})
    assert res.status_code == 422


def test_get_messages_invalid_limit(client):
    res = client.get("/api/v1/chat/messages?limit=200")
    assert res.status_code == 422
