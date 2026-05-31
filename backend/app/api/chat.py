"""
GS-110: Ops chat panel — send and retrieve room messages.

Endpoints:
  POST /api/v1/chat/messages          — send a message to a room (auth required)
  GET  /api/v1/chat/messages?room=ops&limit=50 — load recent history (auth required)

After a message is persisted it is broadcast over the existing SSE channel so
connected clients receive it in real-time without polling.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.response import success_response
from app.api.sse import broadcast_chat_message
from app.db import get_db
from app.models.chat_message import ChatMessage
from app.models.user import User

router = APIRouter(tags=["chat"])

_MAX_BODY = 1000
_MAX_LIMIT = 100
_DEFAULT_ROOM = "ops"


class ChatMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=_MAX_BODY)
    room: str = Field(default=_DEFAULT_ROOM, max_length=50)


class ChatMessageResponse(BaseModel):
    id: int
    user_id: int | None
    user_name: str
    room: str
    body: str
    created_at: str

    class Config:
        from_attributes = True


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

    event_data = {
        "id": msg.id,
        "user_id": msg.user_id,
        "user_name": msg.user_name,
        "room": msg.room,
        "body": msg.body,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }
    await broadcast_chat_message(event_data)

    return success_response(data=event_data, message="Mesaj gönderildi", status_code=201)


@router.get("/messages")
async def get_messages(
    room: str = _DEFAULT_ROOM,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if limit < 1 or limit > _MAX_LIMIT:
        raise HTTPException(status_code=422, detail=f"limit must be 1–{_MAX_LIMIT}")

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room == room)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    # Return chronological order (oldest first for rendering)
    data = [
        {
            "id": r.id,
            "user_id": r.user_id,
            "user_name": r.user_name,
            "room": r.room,
            "body": r.body,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reversed(rows)
    ]
    return success_response(data=data, message="Mesajlar listelendi")
