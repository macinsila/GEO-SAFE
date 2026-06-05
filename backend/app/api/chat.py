"""
GS-110 / GS-112: Ops chat panel.

Endpoints:
  POST   /api/v1/chat/messages                   — send a message
  GET    /api/v1/chat/messages?room=ops&limit=50  — load history (supports ?q= search)
  POST   /api/v1/chat/messages/{room}/read        — upsert read receipt
  POST   /api/v1/chat/presence/{room}             — join room presence
  DELETE /api/v1/chat/presence/{room}             — leave room presence
  GET    /api/v1/chat/presence/{room}             — get online users in room
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.response import success_response
from app.api.sse import broadcast_chat_message, broadcast_presence_update
from app.db import get_db
from app.models.chat_message import ChatMessage
from app.models.chat_read_receipt import ChatReadReceipt
from app.models.user import User

router = APIRouter(tags=["chat"])

_MAX_BODY = 1000
_MAX_LIMIT = 100
_DEFAULT_ROOM = "ops"

# In-memory presence store: room -> {user_id: user_name}
# Lost on restart — acceptable for real-time presence (not persisted state).
_presence: dict[str, dict[int, str]] = {}


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class ChatMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=_MAX_BODY)
    room: str = Field(default=_DEFAULT_ROOM, max_length=50)


class ReadReceiptUpdate(BaseModel):
    last_message_id: int = Field(..., ge=0)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _presence_payload(room: str) -> dict:
    users = _presence.get(room, {})
    return {"room": room, "count": len(users), "users": list(users.values())}


def _serialize(msg: ChatMessage) -> dict:
    return {
        "id": msg.id,
        "user_id": msg.user_id,
        "user_name": msg.user_name,
        "room": msg.room,
        "body": msg.body,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# ── Messages ───────────────────────────────────────────────────────────────────

@router.post("/messages", status_code=201)
async def send_message(
    payload: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = ChatMessage(
        user_id=current_user.id,
        user_name=current_user.name,
        room=payload.room,
        body=payload.body.strip(),
    )
    db.add(msg)
    await db.flush()
    await db.commit()
    await db.refresh(msg)

    event_data = _serialize(msg)
    await broadcast_chat_message(event_data)

    return success_response(data=event_data, message="Mesaj gönderildi", status_code=201)


@router.get("/messages")
async def get_messages(
    room: str = _DEFAULT_ROOM,
    limit: int = 50,
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if limit < 1 or limit > _MAX_LIMIT:
        raise HTTPException(status_code=422, detail=f"limit must be 1–{_MAX_LIMIT}")

    stmt = select(ChatMessage).where(
        ChatMessage.room == room,
        ChatMessage.is_removed.is_(False),
    )
    if q and q.strip():
        stmt = stmt.where(ChatMessage.body.ilike(f"%{q.strip()}%"))

    stmt = stmt.order_by(ChatMessage.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return success_response(data=[_serialize(r) for r in reversed(rows)], message="Mesajlar listelendi")


# ── Read receipts ──────────────────────────────────────────────────────────────

@router.post("/messages/{room}/read", status_code=200)
async def mark_read(
    room: str,
    payload: ReadReceiptUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert the caller's read position for the given room."""
    stmt = pg_insert(ChatReadReceipt).values(
        user_id=current_user.id,
        room=room,
        last_read_message_id=payload.last_message_id,
    ).on_conflict_do_update(
        constraint="uq_chat_read_user_room",
        set_={
            "last_read_message_id": payload.last_message_id,
            "updated_at": ChatReadReceipt.updated_at,
        },
    )
    await db.execute(stmt)
    await db.commit()
    return success_response(data={"room": room, "last_message_id": payload.last_message_id}, message="Okundu işaretlendi")


@router.get("/messages/{room}/read")
async def get_read_receipt(
    room: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the caller's last-read message ID for this room."""
    row = (
        await db.execute(
            select(ChatReadReceipt).where(
                ChatReadReceipt.user_id == current_user.id,
                ChatReadReceipt.room == room,
            )
        )
    ).scalar_one_or_none()
    last_id = row.last_read_message_id if row else 0
    return success_response(data={"room": room, "last_read_message_id": last_id})


# ── Presence ───────────────────────────────────────────────────────────────────

@router.post("/presence/{room}", status_code=200)
async def join_presence(
    room: str,
    current_user: User = Depends(get_current_user),
):
    """Register the current user as online in the given room."""
    if room not in _presence:
        _presence[room] = {}
    _presence[room][current_user.id] = current_user.name
    payload = _presence_payload(room)
    await broadcast_presence_update(payload)
    return success_response(data=payload, message="Katıldı")


@router.delete("/presence/{room}", status_code=200)
async def leave_presence(
    room: str,
    current_user: User = Depends(get_current_user),
):
    """Remove the current user from the room's online list."""
    if room in _presence:
        _presence[room].pop(current_user.id, None)
        if not _presence[room]:
            del _presence[room]
    payload = _presence_payload(room)
    await broadcast_presence_update(payload)
    return success_response(data=payload, message="Ayrıldı")


@router.get("/presence/{room}")
async def get_presence(
    room: str,
    _: User = Depends(get_current_user),
):
    """Return the current online users in the given room."""
    return success_response(data=_presence_payload(room))
