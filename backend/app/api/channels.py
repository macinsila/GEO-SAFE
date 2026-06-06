"""
Mahalle / alan kanalları — GS-111.

Kanallar:
  GET    /api/v1/channels                      — alan kanalları (lat/lon ile mesafeye göre öneri)
  POST   /api/v1/channels                      — kanal oluştur (admin)
  POST   /api/v1/channels/{slug}/join          — kanala katıl (auth)
  POST   /api/v1/channels/{slug}/leave         — kanaldan ayrıl (auth)

Mesajlar (mevcut chat_messages tablosu, room = slug):
  GET    /api/v1/channels/{slug}/messages      — geçmiş (auth, üye)
  POST   /api/v1/channels/{slug}/messages      — mesaj gönder (auth, üye, susturulmamış, rate-limit)

Moderasyon:
  POST   /api/v1/channels/messages/{id}/report — mesajı bildir (auth)
  DELETE /api/v1/channels/messages/{id}        — mesajı kaldır (operator/admin, soft delete)
  POST   /api/v1/channels/{slug}/members/{user_id}/mute   — üyeyi sustur (operator/admin)
  POST   /api/v1/channels/{slug}/members/{user_id}/unmute — susturmayı kaldır (operator/admin)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_roles
from app.api.rate_limit import RateLimiter
from app.api.response import success_response
from app.api.sse import broadcast_chat_message
from app.core.eq_matching import haversine_km
from app.db import get_db
from app.models.chat_channel import (
    ChatChannel,
    ChatChannelMembership,
    ChatMessageReport,
)
from app.models.chat_message import ChatMessage
from app.models.user import User

router = APIRouter(tags=["channels"])

_MAX_BODY = 1000
_MAX_LIMIT = 100

# 10 mesaj / 60 saniye / IP — kanal mesaj akışını sınırla (GS-111 abuse koruması)
channel_message_limiter = RateLimiter(max_requests=10, window_seconds=60)


# ── Şemalar ───────────────────────────────────────────────────────────────────

class ChannelCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z0-9][a-z0-9\-]*$")
    name: str = Field(..., min_length=1, max_length=120)
    center_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    center_lon: Optional[float] = Field(default=None, ge=-180, le=180)
    radius_km: float = Field(default=5.0, gt=0, le=500)


class ChannelMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=_MAX_BODY)


class MessageReportCreate(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


# ── Yardımcılar ─────────────────────────────────────────────────────────────────

async def _get_channel_or_404(db: AsyncSession, slug: str) -> ChatChannel:
    result = await db.execute(select(ChatChannel).where(ChatChannel.slug == slug))
    channel = result.scalars().first()
    if channel is None:
        raise HTTPException(status_code=404, detail="Kanal bulunamadı")
    return channel


async def _get_membership(
    db: AsyncSession, channel_id: int, user_id: int
) -> Optional[ChatChannelMembership]:
    result = await db.execute(
        select(ChatChannelMembership).where(
            ChatChannelMembership.channel_id == channel_id,
            ChatChannelMembership.user_id == user_id,
        )
    )
    return result.scalars().first()


def _serialize_message(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "user_id": m.user_id,
        "user_name": m.user_name,
        "room": m.room,
        "body": m.body,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ── Kanal listesi & oluşturma ──────────────────────────────────────────────────

@router.get("")
async def list_channels(
    lat: Optional[float] = Query(default=None, ge=-90, le=90),
    lon: Optional[float] = Query(default=None, ge=-180, le=180),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alan kanallarını listele. lat/lon verilirse mesafeye göre sırala ve
    kullanıcının dairesi içindekileri 'suggested' işaretle."""
    channels = (await db.execute(select(ChatChannel))).scalars().all()

    member_rows = (
        await db.execute(
            select(ChatChannelMembership.channel_id).where(
                ChatChannelMembership.user_id == current_user.id
            )
        )
    ).scalars().all()
    joined_ids = set(member_rows)

    items = []
    for c in channels:
        distance_km = None
        suggested = False
        if lat is not None and lon is not None and c.center_lat is not None and c.center_lon is not None:
            distance_km = round(haversine_km(lat, lon, c.center_lat, c.center_lon), 2)
            suggested = distance_km <= c.radius_km
        items.append(
            {
                "id": c.id,
                "slug": c.slug,
                "name": c.name,
                "center_lat": c.center_lat,
                "center_lon": c.center_lon,
                "radius_km": c.radius_km,
                "joined": c.id in joined_ids,
                "distance_km": distance_km,
                "suggested": suggested,
            }
        )

    if lat is not None and lon is not None:
        # Mesafesi bilinenler önce (yakından uzağa), sonra mesafesizler.
        items.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0))

    return success_response(data=items, message="Kanallar listelendi")


@router.post("", status_code=201)
async def create_channel(
    payload: ChannelCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "operator")),
):
    existing = (
        await db.execute(select(ChatChannel).where(ChatChannel.slug == payload.slug))
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="Bu slug zaten kullanılıyor")

    channel = ChatChannel(
        slug=payload.slug,
        name=payload.name,
        center_lat=payload.center_lat,
        center_lon=payload.center_lon,
        radius_km=payload.radius_km,
    )
    db.add(channel)
    await db.flush()
    channel_id = channel.id
    await db.commit()
    channel = (
        await db.execute(select(ChatChannel).where(ChatChannel.id == channel_id))
    ).scalar_one()
    return success_response(
        data={
            "id": channel.id,
            "slug": channel.slug,
            "name": channel.name,
            "center_lat": channel.center_lat,
            "center_lon": channel.center_lon,
            "radius_km": channel.radius_km,
        },
        message="Kanal oluşturuldu",
    )


# ── Katıl / ayrıl ──────────────────────────────────────────────────────────────

@router.post("/{slug}/join")
async def join_channel(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await _get_channel_or_404(db, slug)
    membership = await _get_membership(db, channel.id, current_user.id)
    if membership is None:
        membership = ChatChannelMembership(
            channel_id=channel.id, user_id=current_user.id
        )
        db.add(membership)
        await db.commit()
    return success_response(data={"joined": True, "slug": slug}, message="Kanala katıldınız")


@router.post("/{slug}/leave")
async def leave_channel(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    channel = await _get_channel_or_404(db, slug)
    membership = await _get_membership(db, channel.id, current_user.id)
    if membership is not None:
        await db.delete(membership)
        await db.commit()
    return success_response(data={"left": True, "slug": slug}, message="Kanaldan ayrıldınız")


# ── Mesajlar ────────────────────────────────────────────────────────────────────

@router.get("/{slug}/messages")
async def get_channel_messages(
    slug: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if limit < 1 or limit > _MAX_LIMIT:
        raise HTTPException(status_code=422, detail=f"limit must be 1–{_MAX_LIMIT}")
    await _get_channel_or_404(db, slug)

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room == slug, ChatMessage.is_removed.is_(False))
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    data = [_serialize_message(m) for m in reversed(rows)]
    return success_response(data=data, message="Mesajlar listelendi")


@router.post("/{slug}/messages", status_code=201)
async def send_channel_message(
    slug: str,
    payload: ChannelMessageCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await channel_message_limiter.check(request)
    channel = await _get_channel_or_404(db, slug)

    membership = await _get_membership(db, channel.id, current_user.id)
    if membership is None:
        raise HTTPException(status_code=403, detail="Önce kanala katılmalısınız")
    if membership.muted:
        raise HTTPException(status_code=403, detail="Bu kanalda susturuldunuz")

    msg = ChatMessage(
        user_id=current_user.id,
        user_name=current_user.name,
        room=slug,
        body=payload.body.strip(),
    )
    db.add(msg)
    await db.flush()
    await db.commit()
    await db.refresh(msg)

    event_data = _serialize_message(msg)
    await broadcast_chat_message(event_data)
    return success_response(data=event_data, message="Mesaj gönderildi")


# ── Moderasyon ──────────────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/report", status_code=201)
async def report_message(
    message_id: int,
    payload: MessageReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = (
        await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
    ).scalars().first()
    if msg is None:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")

    report = ChatMessageReport(
        message_id=message_id,
        reporter_user_id=current_user.id,
        reason=payload.reason,
    )
    db.add(report)
    await db.commit()
    return success_response(data={"reported": True}, message="Mesaj bildirildi")


@router.delete("/messages/{message_id}")
async def remove_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "operator")),
):
    msg = (
        await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
    ).scalars().first()
    if msg is None:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    msg.is_removed = True
    await db.commit()
    return success_response(data={"removed": True}, message="Mesaj kaldırıldı")


@router.post("/{slug}/members/{user_id}/mute")
async def mute_member(
    slug: str,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "operator")),
):
    channel = await _get_channel_or_404(db, slug)
    membership = await _get_membership(db, channel.id, user_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Üyelik bulunamadı")
    membership.muted = True
    await db.commit()
    return success_response(data={"muted": True}, message="Üye susturuldu")


@router.post("/{slug}/members/{user_id}/unmute")
async def unmute_member(
    slug: str,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "operator")),
):
    channel = await _get_channel_or_404(db, slug)
    membership = await _get_membership(db, channel.id, user_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Üyelik bulunamadı")
    membership.muted = False
    await db.commit()
    return success_response(data={"muted": False}, message="Üye susturması kaldırıldı")
