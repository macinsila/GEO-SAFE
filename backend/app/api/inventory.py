from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
from typing import Optional
from app.db import get_db
from app.models.safe_zone import SafeZone
from app.api.auth import require_roles
from app.api.response import success_response
from app.models.user import User

router = APIRouter(tags=["inventory"])

class StokGuncelle(BaseModel):
    water: Optional[str] = "-"
    food: Optional[str] = "-"
    med: Optional[str] = "-"
    blanket: Optional[int] = 0
    ext: Optional[int] = 0

@router.get("/safe-zone/{zone_id}")
async def stok_getir(zone_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Bölge bulunamadı")
    
    data = zone.data or {}
    return success_response(data={
        "zone_id": zone_id,
        "name": zone.name,
        "water": data.get("water", "-"),
        "food": data.get("food", "-"),
        "med": data.get("med", "-"),
        "blanket": data.get("blanket", 0),
        "ext": data.get("ext", 0)
    }, message="Inventory fetched")

@router.put("/safe-zone/{zone_id}")
async def stok_guncelle(
    zone_id: int,
    payload: StokGuncelle,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Bölge bulunamadı")

    new_data = dict(zone.data or {})
    new_data["water"] = payload.water
    new_data["food"] = payload.food
    new_data["med"] = payload.med
    new_data["blanket"] = payload.blanket
    new_data["ext"] = payload.ext
    zone.data = new_data
    flag_modified(zone, "data")

    await db.commit()
    await db.refresh(zone)
    return success_response(data={"zone_id": zone_id}, message="Stok güncellendi")