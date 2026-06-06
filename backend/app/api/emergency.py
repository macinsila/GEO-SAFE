"""
Emergency report API endpoints.
Public: POST (rate-limited, no auth).
Admin: GET (list + filter), PATCH /{id}/status, DELETE (bulk clear).
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.rate_limit import emergency_limiter, public_form_dedup
from app.api.response import success_response
from app.api.storage import ALLOWED_TYPES, MAX_UPLOAD_BYTES, upload_image
from app.db import get_db
from app.models.emergency_report import EmergencyReport
from app.models.user import User
from app.schemas import EmergencyAdminResponse, EmergencyStatusUpdate

_Opt = Optional

router = APIRouter(tags=["emergency"])

# Statuses from which a report cannot be moved back into active triage.
# Prevents re-opening confirmed fake/spam submissions.
_TERMINAL_STATUSES = frozenset({"spam", "dismissed"})


class EmergencyCreate(BaseModel):
    durum: str
    saat: str
    harita_link: str
    enlem: float
    boylam: float
    kategori: _Opt[str] = None
    aciklama: _Opt[str] = None


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
    await public_form_dedup.check(request, payload.model_dump())
    bildirim = EmergencyReport(
        durum=payload.kategori or payload.durum,
        kategori=payload.kategori,
        aciklama=payload.aciklama,
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

    # GS-023: yakındaki geofence abonelerini best-effort uyar. Push yapılandırılmamışsa
    # veya herhangi bir hata olursa rapor akışını ASLA bozma.
    await _notify_geofenced_subscribers(db, bildirim)

    # Intentionally minimal response — avoids giving false confidence to sender.
    return success_response(data={"id": bildirim.id}, message="Bildirim alındı")


async def _notify_geofenced_subscribers(
    db: AsyncSession, report: EmergencyReport
) -> None:
    """GS-023: acil bildirim konumunun yakınındaki abonelere Web Push gönder.

    Best-effort: VAPID yoksa veya herhangi bir hata olursa sessizce geç."""
    try:
        from app.api.push import _vapid_configured
        from app.core.geofence import dispatch_geofenced_alert

        if not _vapid_configured():
            return
        if report.enlem is None or report.boylam is None:
            return

        kategori = report.kategori or report.durum or "Acil durum"
        await dispatch_geofenced_alert(
            db,
            lat=float(report.enlem),
            lon=float(report.boylam),
            title="Yakınınızda acil durum",
            body=f"{kategori} bildirimi yakınınızda alındı.",
            url="/",
            tag="geosafe-geofence",
        )
    except Exception:
        # Bildirim sevkiyatı asla acil rapor kaydını etkilemez.
        pass


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

    if report.status in _TERMINAL_STATUSES and payload.status not in _TERMINAL_STATUSES:
        raise HTTPException(
            status_code=422,
            detail="Bu bildirim terminal durumda (spam/reddedildi). Yeniden açılamaz.",
        )

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


# ── Public: attach photo to an existing emergency report ────────────────────
@router.post("/{report_id}/image", status_code=200)
async def upload_emergency_image(
    report_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmergencyReport).where(EmergencyReport.id == report_id)
    )
    report = result.scalars().first()
    if report is None:
        raise HTTPException(status_code=404, detail="Emergency report not found")

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '{content_type}'. Allowed: {sorted(ALLOWED_TYPES)}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"File too large ({len(file_bytes) // 1024} KB). Maximum is {MAX_UPLOAD_BYTES // (1024*1024)} MB.",
        )

    image_url = await upload_image(file_bytes, content_type)
    report.image_url = image_url
    await db.flush()
    await db.commit()
    result = await db.execute(
        select(EmergencyReport).where(EmergencyReport.id == report_id)
    )
    report = result.scalar_one()
    return success_response(
        data={"id": report.id, "image_url": report.image_url},
        message="Image uploaded",
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
