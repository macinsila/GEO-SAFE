"""
Safe-zone needs intake — GS-053.

POST /api/v1/zone-needs              — report a need (operator/admin)
GET  /api/v1/zone-needs              — list all needs (operator/admin)
GET  /api/v1/zone-needs/{zone_id}    — needs for a specific safe zone
PATCH /api/v1/zone-needs/{id}/close  — mark need as fulfilled (admin)
"""

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.response import success_response
from app.db import get_db
from app.models.user import User
from app.models.zone_need import ZoneNeed

router = APIRouter(tags=["zone-needs"])

PRIORITIES = Literal["low", "normal", "high", "critical"]


class ZoneNeedCreate(BaseModel):
    safe_zone_id: int
    item_id: Optional[int] = None
    item_name_free: Optional[str] = None
    quantity_needed: int = Field(..., gt=0)
    priority: PRIORITIES = "normal"
    note: Optional[str] = None


class ZoneNeedResponse(BaseModel):
    id: int
    safe_zone_id: int
    item_id: Optional[int]
    item_name_free: Optional[str]
    quantity_needed: int
    priority: str
    reported_by: Optional[int]
    status: str
    note: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.post("", status_code=201)
async def report_need(
    payload: ZoneNeedCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    if not payload.item_id and not payload.item_name_free:
        raise HTTPException(status_code=400, detail="item_id veya item_name_free gereklidir")

    need = ZoneNeed(
        safe_zone_id=payload.safe_zone_id,
        item_id=payload.item_id,
        item_name_free=payload.item_name_free,
        quantity_needed=payload.quantity_needed,
        priority=payload.priority,
        reported_by=current_user.id,
        note=payload.note,
    )
    db.add(need)
    await db.flush()
    need_id = need.id
    await db.commit()
    result = await db.execute(select(ZoneNeed).where(ZoneNeed.id == need_id))
    need = result.scalar_one()
    return success_response(
        data=ZoneNeedResponse.model_validate(need).model_dump(),
        message="İhtiyaç bildirimi oluşturuldu",
    )


@router.get("")
async def list_needs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "operator")),
    status: Optional[str] = Query(default="open"),
    limit: int = Query(default=100, le=500),
):
    stmt = (
        select(ZoneNeed)
        .order_by(ZoneNeed.created_at.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(ZoneNeed.status == status)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return success_response(
        data=[ZoneNeedResponse.model_validate(n).model_dump() for n in items],
        message=f"{len(items)} ihtiyaç kaydı",
    )


@router.get("/zone/{safe_zone_id}")
async def needs_for_zone(
    safe_zone_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "operator")),
):
    result = await db.execute(
        select(ZoneNeed)
        .where(ZoneNeed.safe_zone_id == safe_zone_id, ZoneNeed.status == "open")
        .order_by(ZoneNeed.priority.desc(), ZoneNeed.created_at.desc())
    )
    items = result.scalars().all()
    return success_response(
        data=[ZoneNeedResponse.model_validate(n).model_dump() for n in items],
        message=f"Toplanma alanı #{safe_zone_id}: {len(items)} açık ihtiyaç",
    )


@router.patch("/{need_id}/close")
async def close_need(
    need_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    result = await db.execute(select(ZoneNeed).where(ZoneNeed.id == need_id))
    need = result.scalar_one_or_none()
    if not need:
        raise HTTPException(status_code=404, detail="İhtiyaç kaydı bulunamadı")
    need.status = "fulfilled"
    await db.commit()
    return success_response(
        data={"need_id": need_id, "status": "fulfilled"},
        message="İhtiyaç karşılandı olarak işaretlendi",
    )
