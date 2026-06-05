"""
Server-Sent Events (SSE) — Live announcement channel (GS-020).

Architecture:
  - A module-level broadcaster holds a set of active client queues.
  - When an admin publishes an announcement, they call `broadcast_announcement`.
  - /api/v1/sse/announcements streams events to all connected clients.
  - Heartbeat every 25 s keeps proxies from closing idle connections.
"""

import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["sse"])

# Each connected client gets its own asyncio.Queue
_clients: set[asyncio.Queue] = set()


def _register() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _clients.add(q)
    return q


def _unregister(q: asyncio.Queue) -> None:
    _clients.discard(q)


async def _broadcast(event_type: str, data: dict) -> None:
    """Internal: push a typed event to all connected SSE clients."""
    payload = json.dumps({"type": event_type, "data": data}, default=str)
    dead: list[asyncio.Queue] = []
    for q in list(_clients):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _unregister(q)


async def broadcast_announcement(announcement: dict) -> None:
    """Push a published announcement to all connected SSE clients."""
    await _broadcast("announcement", announcement)


async def broadcast_low_stock_alert(alert: dict) -> None:
    """Push a low-stock alert to all connected SSE clients (GS-081)."""
    await _broadcast("low_stock_alert", alert)


async def broadcast_chat_message(message: dict) -> None:
    """Push a chat message to all connected SSE clients (GS-110)."""
    await _broadcast("chat_message", message)


async def broadcast_inventory_update(update: dict) -> None:
    """Push a live inventory change to all connected SSE clients (GS-022)."""
    await _broadcast("inventory_update", update)


async def broadcast_presence_update(presence: dict) -> None:
    """Push a chat-room presence change to all connected SSE clients (GS-112)."""
    await _broadcast("presence_update", presence)


async def _event_stream(q: asyncio.Queue) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted strings; sends a heartbeat comment every 25 s."""
    try:
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=25)
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                # Keep-alive — SSE comment, invisible to JS EventSource
                yield f": heartbeat {datetime.utcnow().isoformat()}\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        _unregister(q)


@router.get("/announcements")
async def stream_announcements():
    """
    SSE endpoint — connect with EventSource('/api/v1/sse/announcements').
    Events have type 'announcement' and carry the full announcement payload.
    """
    q = _register()
    return StreamingResponse(
        _event_stream(q),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable Nginx buffering
            "Connection": "keep-alive",
        },
    )


@router.get("/health")
async def sse_health():
    """Returns the current number of connected SSE clients (for monitoring)."""
    return {"connected_clients": len(_clients)}
