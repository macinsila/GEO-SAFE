"""
Emergency report API endpoints.
Public: POST (rate-limited, no auth).
Admin: GET (list + filter), PATCH /{id}/status, DELETE (bulk clear).
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.api.auth import require_roles
from app.api.rate_limit import emergency_limiter
from app.models.emergency_report import EmergencyReport
from app.api.response import success_response
from app.models.user import User
from app.schemas import EmergencyAdminResponse, EmergencyStatusUpdate

router = APIRouter(tags=["emergency"])

from pydantic import BaseModel


class EmergencyCreate(BaseModel):
    durum: str
    saat: str
    harita_link: str
    enlem: float
    boylam: float


def _serialize_admin(report: EmergencyReport) -> dict:
    return EmergencyAdminResponse.model_validate(report).model_dump()


# ── Public: submit an emergency report ─────────────────────────────────────
@router.post("", status_code=201)
async def acil_bildirim_gonder(
    payload: EmergencyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await emergency_limiter.check(request)
    bildirim = EmergencyReport(
        durum=payload.durum,
        saat=payload.saat,
        harita_link=payload.harita_link,
        enlem=payload.enlem,
        boylam=payload.boylam,
        status="new",
    )
    db.add(bildirim)
    await db.flush()
    bildirim_id = bildirim.id
    await db.commit()
    result = await db.execute(
        select(EmergencyReport).where(EmergencyReport.id == bildirim_id)
    )
    bildirim = result.scalar_one()
    # Intentionally minimal response — avoids giving false confidence to sender.
    return success_response(data={"id": bildirim.id}, message="Bildirim alındı")


# ── Admin: list emergency reports (with optional status filter) ─────────────
@router.get("")
@router.get("/admin")
async def bildirimleri_getir(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
    status: Optional[str] = Query(default=None, description="Filter by status"),
):
    stmt = select(EmergencyReport).order_by(EmergencyReport.id.desc())
    if status is not None:
        stmt = stmt.where(EmergencyReport.status == status)
    result = await db.execute(stmt)
    return success_response(
        data=[_serialize_admin(report) for report in result.scalars().all()],
        message="Bildirimler listelendi",
    )


# ── Admin: update a single emergency report status ──────────────────────────
@router.patch("/admin/{report_id}/status")
async def update_emergency_status(
    report_id: int,
    payload: EmergencyStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(
        select(EmergencyReport).where(EmergencyReport.id == report_id)
    )
    report = result.scalars().first()
    if report is None:
        raise HTTPException(status_code=404, detail="Emergency report not found")

    report.status = payload.status
    await db.flush()
    report_id = report.id
    await db.commit()
    result = await db.execute(
        select(EmergencyReport).where(EmergencyReport.id == report_id)
    )
    report = result.scalar_one()

    return success_response(
        data=_serialize_admin(report),
        message="Emergency status updated",
    )


# ── Admin: bulk-clear all emergency reports ─────────────────────────────────
@router.delete("")
async def bildirimleri_temizle(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(select(EmergencyReport))
    bildirimler = result.scalars().all()
    for b in bildirimler:
        await db.delete(b)
    await db.commit()
    return success_response(data={"deleted": len(bildirimler)}, message="Bildirimler temizlendi")
