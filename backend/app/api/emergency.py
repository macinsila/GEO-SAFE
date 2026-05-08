from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db import get_db
from app.api.auth import require_roles
from app.api.rate_limit import emergency_limiter
from app.models.emergency_report import EmergencyReport
from app.api.response import success_response
from app.models.user import User

router = APIRouter(tags=["emergency"])

class EmergencyCreate(BaseModel):
    durum: str
    saat: str
    harita_link: str
    enlem: float
    boylam: float

class EmergencyResponse(BaseModel):
    id: int
    durum: str
    saat: str
    harita_link: str

    class Config:
        from_attributes = True

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
        boylam=payload.boylam
    )
    db.add(bildirim)
    await db.commit()
    await db.refresh(bildirim)
    return success_response(data={"id": bildirim.id}, message="Bildirim alındı")

@router.get("")
async def bildirimleri_getir(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(select(EmergencyReport).order_by(EmergencyReport.id.desc()))
    return success_response(data=result.scalars().all(), message="Bildirimler listelendi")

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