"""
Safe check-in API — GS-040 'I am safe'.

POST /api/v1/checkin        — submit a check-in (authenticated or anonymous offline-sync)
GET  /api/v1/checkin        — list recent check-ins (admin only)
GET  /api/v1/checkin/mine   — my own check-ins (authenticated user)
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, get_optional_current_user, require_roles
from app.api.response import success_response
from app.db import get_db
from app.models.safe_checkin import SafeCheckin
from app.models.user import User

router = APIRouter(tags=["checkin"])


class CheckinCreate(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    note: Optional[str] = None
    source: str = "online"


class CheckinResponse(BaseModel):
    id: int
    user_id: Optional[int]
    name: Optional[str]
    lat: Optional[float]
    lon: Optional[float]
    note: Optional[str]
    source: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Public / citizen ─────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_checkin(
    payload: CheckinCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    checkin = SafeCheckin(
        user_id=current_user.id if current_user else None,
        name=payload.name or (current_user.name if current_user else None),
        lat=payload.lat,
        lon=payload.lon,
        note=payload.note,
        source=payload.source,
    )
    db.add(checkin)
    await db.flush()
    checkin_id = checkin.id
    await db.commit()
    result = await db.execute(select(SafeCheckin).where(SafeCheckin.id == checkin_id))
    checkin = result.scalar_one()
    return success_response(
        data=CheckinResponse.model_validate(checkin).model_dump(),
        message="Güvendeyim bildirimi alındı",
    )


@router.get("/mine")
async def my_checkins(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=20, le=100),
):
    stmt = (
        select(SafeCheckin)
        .where(SafeCheckin.user_id == current_user.id)
        .order_by(SafeCheckin.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return success_response(
        data=[CheckinResponse.model_validate(c).model_dump() for c in items],
        message=f"{len(items)} check-in bulundu",
    )


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_checkins(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
    hours: int = Query(default=24, le=168, description="Son kaç saatteki kayıtlar"),
    limit: int = Query(default=100, le=500),
):
    since = datetime.utcnow() - timedelta(hours=hours)
    stmt = (
        select(SafeCheckin)
        .where(SafeCheckin.created_at >= since)
        .order_by(SafeCheckin.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return success_response(
        data=[CheckinResponse.model_validate(c).model_dump() for c in items],
        message=f"Son {hours} saatte {len(items)} check-in",
    )
