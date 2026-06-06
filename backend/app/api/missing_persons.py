"""
Kayıp kişi / yeniden birleşme panosu — GS-041.

  POST   /api/v1/missing-persons          — kayıp kişi bildir (herkese açık, rate-limit)
  GET    /api/v1/missing-persons          — listele / ara (herkese açık)
  PATCH  /api/v1/missing-persons/{id}/status — durum güncelle (admin/operator)

Gizlilik: kesin konum saklanmaz. Soft-delete: status='removed'.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.rate_limit import RateLimiter
from app.api.response import success_response
from app.db import get_db
from app.models.missing_person import MissingPerson

router = APIRouter(tags=["missing-persons"])

_report_limiter = RateLimiter(max_requests=5, window_seconds=60)

_ALLOWED_STATUSES = frozenset({"active", "found", "removed"})


# ── Şemalar ───────────────────────────────────────────────────────────────────

class MissingPersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    last_seen_district: str = Field(..., min_length=1, max_length=200)
    last_seen_description: Optional[str] = Field(default=None, max_length=2000)
    photo_url: Optional[str] = Field(default=None, max_length=500)
    contact_info: Optional[str] = Field(default=None, max_length=500)


class MissingPersonStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|found|removed)$")


def _serialize(record: MissingPerson) -> dict:
    return {
        "id": record.id,
        "name": record.name,
        "age": record.age,
        "last_seen_district": record.last_seen_district,
        "last_seen_description": record.last_seen_description,
        "photo_url": record.photo_url,
        "contact_info": record.contact_info,
        "status": record.status,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def report_missing_person(
    payload: MissingPersonCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Kayıp kişi bildirimi gönder. Herkese açık, rate-limit uygulanır."""
    await _report_limiter.check(request)

    record = MissingPerson(
        name=payload.name.strip(),
        age=payload.age,
        last_seen_district=payload.last_seen_district.strip(),
        last_seen_description=payload.last_seen_description,
        photo_url=payload.photo_url,
        contact_info=payload.contact_info,
        status="active",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return success_response(data=_serialize(record), message="Kayıp kişi bildirimi alındı")


@router.get("")
async def list_missing_persons(
    name: Optional[str] = Query(default=None, max_length=200),
    district: Optional[str] = Query(default=None, max_length=200),
    status: Optional[str] = Query(default="active"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Kayıp kişileri listele / ara. Herkese açık."""
    q = select(MissingPerson)

    if status and status in _ALLOWED_STATUSES:
        q = q.where(MissingPerson.status == status)
    elif status == "all":
        pass  # filtre yok
    else:
        q = q.where(MissingPerson.status == "active")

    if name:
        q = q.where(MissingPerson.name.ilike(f"%{name.strip()}%"))

    if district:
        q = q.where(MissingPerson.last_seen_district.ilike(f"%{district.strip()}%"))

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    q = q.order_by(MissingPerson.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    records = result.scalars().all()

    return success_response(
        data={"items": [_serialize(r) for r in records], "total": total},
        message="OK",
    )


@router.patch("/{record_id}/status")
async def update_missing_person_status(
    record_id: int,
    payload: MissingPersonStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: object = Depends(require_roles("admin", "operator")),
):
    """Durumu güncelle veya soft-delete uygula (admin/operator)."""
    result = await db.execute(
        select(MissingPerson).where(MissingPerson.id == record_id)
    )
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Kayıp kişi kaydı bulunamadı")

    record.status = payload.status
    record.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(record)
    return success_response(data=_serialize(record), message="Durum güncellendi")
