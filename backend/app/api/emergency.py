from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from pydantic import BaseModel
from app.db import get_db
from app.models.base import Base

router = APIRouter(prefix="/api/emergency", tags=["emergency"])

class EmergencyModel(Base):
    __tablename__ = "emergency_reports"
    id = Column(Integer, primary_key=True)
    durum = Column(String)
    saat = Column(String)
    harita_link = Column(String)
    enlem = Column(Float)
    boylam = Column(Float)
    created_at = Column(DateTime, server_default=func.now())

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
async def acil_bildirim_gonder(payload: EmergencyCreate, db: AsyncSession = Depends(get_db)):
    bildirim = EmergencyModel(
        durum=payload.durum,
        saat=payload.saat,
        harita_link=payload.harita_link,
        enlem=payload.enlem,
        boylam=payload.boylam
    )
    db.add(bildirim)
    await db.commit()
    await db.refresh(bildirim)
    return {"message": "Bildirim alındı", "id": bildirim.id}

@router.get("", response_model=list[EmergencyResponse])
async def bildirimleri_getir(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmergencyModel).order_by(EmergencyModel.id.desc()))
    return result.scalars().all()

@router.delete("")
async def bildirimleri_temizle(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmergencyModel))
    bildirimler = result.scalars().all()
    for b in bildirimler:
        await db.delete(b)
    await db.commit()
    return {"message": "Bildirimler temizlendi"}