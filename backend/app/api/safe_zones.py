"""
SafeZone API endpoints
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models import SafeZone
from app.schemas import SafeZoneResponse, SafeZoneCreate
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(tags=["safe-zones"])


@router.get("", response_model=list[SafeZoneResponse])
async def list_safe_zones(db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(SafeZone).order_by(SafeZone.id)
        result = await db.execute(stmt)
        safe_zones = result.scalars().all()

        for zone in safe_zones:
            if zone.geometry is None and zone.data:
                try:
                    meta = json.loads(zone.data) if isinstance(zone.data, str) else zone.data
                    bounds = meta.get("bounds", {})
                    if bounds:
                        minLon = bounds.get("minLon", 0)
                        maxLon = bounds.get("maxLon", 0)
                        minLat = bounds.get("minLat", 0)
                        maxLat = bounds.get("maxLat", 0)
                        zone.geometry = {
                            "type": "Polygon",
                            "coordinates": [[
                                [minLon, minLat],
                                [maxLon, minLat],
                                [maxLon, maxLat],
                                [minLon, maxLat],
                                [minLon, minLat]
                            ]]
                        }
                except (json.JSONDecodeError, AttributeError, KeyError):
                    pass

        return safe_zones
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching safe zones: {str(e)}")


@router.get("/{zone_id}", response_model=SafeZoneResponse)
async def get_safe_zone(zone_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    safe_zone = result.scalar_one_or_none()

    if not safe_zone:
        raise HTTPException(status_code=404, detail=f"Safe zone {zone_id} not found")

    return safe_zone


@router.post("", response_model=SafeZoneResponse, status_code=201)
async def create_safe_zone(
    payload: SafeZoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    coords = payload.geometry.get("coordinates", [[]])[0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    zone = SafeZone(
        name=payload.name,
        capacity=payload.capacity,
        status=payload.status,
        data={"bounds": {
            "minLon": min(lons),
            "maxLon": max(lons),
            "minLat": min(lats),
            "maxLat": max(lats)
        }}
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return zone


@router.put("/{zone_id}", response_model=SafeZoneResponse)
async def update_safe_zone(
    zone_id: int,
    payload: SafeZoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(status_code=404, detail="Safe zone bulunamadı")

    coords = payload.geometry.get("coordinates", [[]])[0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    zone.name = payload.name
    zone.capacity = payload.capacity
    zone.status = payload.status
    zone.data = {"bounds": {
        "minLon": min(lons),
        "maxLon": max(lons),
        "minLat": min(lats),
        "maxLat": max(lats)
    }}

    await db.commit()
    await db.refresh(zone)
    return zone


@router.delete("/{zone_id}", status_code=204)
async def delete_safe_zone(
    zone_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(status_code=404, detail="Safe zone bulunamadı")

    await db.delete(zone)
    await db.commit()