"""
SafeZone API endpoints
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.elements import WKBElement, WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.observability import collector
from app.api.response import success_response
from app.core import cache
from app.db import get_db
from app.models import SafeZone
from app.models.user import User
from app.schemas import SafeZoneCreate

_CACHE_KEY = "safe_zones:list"
_CACHE_TTL = 300

router = APIRouter(tags=["safe-zones"])


def _coords_to_wkt_polygon(coords: list[list[float]]) -> str:
    if len(coords) < 3:
        raise HTTPException(status_code=400, detail="Geometry requires at least 3 points")
    if coords[0] != coords[-1]:
        coords = coords + [coords[0]]
    points = ", ".join(f"{lon} {lat}" for lon, lat in coords)
    return f"POLYGON(({points}))"


def _serialize_safe_zone(zone: SafeZone, *, include_private: bool = False) -> dict:
    geometry_payload = None

    if zone.geometry is not None:
        try:
            if isinstance(zone.geometry, dict):
                geometry_payload = zone.geometry
            elif isinstance(zone.geometry, WKBElement):
                polygon = to_shape(zone.geometry)
                geometry_payload = polygon.__geo_interface__
        except Exception:
            geometry_payload = None

    if geometry_payload is None and zone.data:
        try:
            meta = json.loads(zone.data) if isinstance(zone.data, str) else zone.data
            bounds = meta.get("bounds", {})
            if bounds:
                min_lon = bounds.get("minLon", 0)
                max_lon = bounds.get("maxLon", 0)
                min_lat = bounds.get("minLat", 0)
                max_lat = bounds.get("maxLat", 0)
                geometry_payload = {
                    "type": "Polygon",
                    "coordinates": [[
                        [min_lon, min_lat],
                        [max_lon, min_lat],
                        [max_lon, max_lat],
                        [min_lon, max_lat],
                        [min_lon, min_lat],
                    ]],
                }
        except (json.JSONDecodeError, AttributeError, KeyError, TypeError):
            geometry_payload = None

    payload = {
        "id": zone.id,
        "name": zone.name,
        "capacity": zone.capacity,
        "capacity_type": zone.capacity_type,
        "status": zone.status,
        "geometry": geometry_payload,
        "created_at": zone.created_at,
    }
    if include_private:
        payload["data"] = zone.data
    return payload


@router.get("")
async def list_safe_zones(db: AsyncSession = Depends(get_db)):
    try:
        cached = await cache.get(_CACHE_KEY)
        if cached is not None:
            collector.record_cache_hit("safe_zones")
            return success_response(data=cached, message="Safe zones listed")

        collector.record_cache_miss("safe_zones")
        stmt = select(SafeZone).order_by(SafeZone.id)
        result = await db.execute(stmt)
        safe_zones = result.scalars().all()
        data = [_serialize_safe_zone(zone) for zone in safe_zones]
        await cache.set(_CACHE_KEY, data, ttl=_CACHE_TTL)
        return success_response(data=data, message="Safe zones listed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching safe zones: {str(e)}")


@router.get("/admin")
async def list_safe_zones_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    stmt = select(SafeZone).order_by(SafeZone.id)
    result = await db.execute(stmt)
    zones = result.scalars().all()
    return success_response(
        data=[_serialize_safe_zone(zone, include_private=True) for zone in zones],
        message="Admin safe zones listed",
    )


@router.get("/{zone_id}")
async def get_safe_zone(zone_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    safe_zone = result.scalar_one_or_none()

    if not safe_zone:
        raise HTTPException(status_code=404, detail=f"Safe zone {zone_id} not found")

    return success_response(data=_serialize_safe_zone(safe_zone), message="Safe zone fetched")


@router.post("", status_code=201)
async def create_safe_zone(
    payload: SafeZoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    coords = payload.geometry.get("coordinates", [[]])[0]
    if not coords:
        raise HTTPException(status_code=400, detail="Geometry coordinates are required")
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    zone = SafeZone(
        name=payload.name,
        capacity=payload.capacity,
        status=payload.status,
        geometry=WKTElement(_coords_to_wkt_polygon(coords), srid=4326),
        data={"bounds": {
            "minLon": min(lons),
            "maxLon": max(lons),
            "minLat": min(lats),
            "maxLat": max(lats)
        }}
    )
    db.add(zone)
    await db.flush()
    await db.refresh(zone)
    await db.commit()
    await cache.delete(_CACHE_KEY)
    collector.record_cache_invalidation("safe_zones")
    return success_response(data=_serialize_safe_zone(zone, include_private=True), message="Safe zone created")


@router.put("/{zone_id}")
async def update_safe_zone(
    zone_id: int,
    payload: SafeZoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(status_code=404, detail="Safe zone bulunamadı")

    coords = payload.geometry.get("coordinates", [[]])[0]
    if not coords:
        raise HTTPException(status_code=400, detail="Geometry coordinates are required")
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    zone.name = payload.name
    zone.capacity = payload.capacity
    zone.status = payload.status
    zone.geometry = WKTElement(_coords_to_wkt_polygon(coords), srid=4326)
    zone.data = {"bounds": {
        "minLon": min(lons),
        "maxLon": max(lons),
        "minLat": min(lats),
        "maxLat": max(lats)
    }}

    await db.flush()
    await db.refresh(zone)
    await db.commit()
    await cache.delete(_CACHE_KEY)
    collector.record_cache_invalidation("safe_zones")
    return success_response(data=_serialize_safe_zone(zone, include_private=True), message="Safe zone updated")


@router.delete("/{zone_id}")
async def delete_safe_zone(
    zone_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()

    if not zone:
        raise HTTPException(status_code=404, detail="Safe zone bulunamadı")

    await db.delete(zone)
    await db.commit()
    await cache.delete(_CACHE_KEY)
    collector.record_cache_invalidation("safe_zones")
    return success_response(data={"id": zone_id}, message="Safe zone deleted")
