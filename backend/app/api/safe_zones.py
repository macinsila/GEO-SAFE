"""
SafeZone API endpoints
GET /safe-zones - List all safe zones with their boundaries
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models import SafeZone
from app.schemas import SafeZoneResponse

router = APIRouter(prefix="/api/safe-zones", tags=["safe-zones"])


@router.get("", response_model=list[SafeZoneResponse])
async def list_safe_zones(db: AsyncSession = Depends(get_db)):
    """
    List all safe zones with their boundaries.
    
    Returns a list of safe zone records with geometry in GeoJSON format.
    Each safe zone contains:
    - id: Unique identifier
    - name: Zone name
    - geometry: Polygon geometry in GeoJSON format {type: "Polygon", coordinates: [[[lon, lat], ...]]}
    - capacity: Maximum persons/items
    - capacity_type: Unit type (persons, tons, etc.)
    - status: active/inactive/closed
    - created_at: Creation timestamp
    
    Example response:
    ```json
    [
      {
        "id": 1,
        "name": "Taksim Square Safe Zone",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[28.975, 41.006], [28.982, 41.006], [28.982, 41.011], [28.975, 41.011], [28.975, 41.006]]]
        },
        "capacity": 2000,
        "capacity_type": "persons",
        "status": "active",
        "created_at": "2025-12-24T12:00:00"
      }
    ]
    ```
    """
    try:
        stmt = select(SafeZone).order_by(SafeZone.id)
        result = await db.execute(stmt)
        safe_zones = result.scalars().all()
        
        # For SQLite: extract bounds from data JSON and create geometry GeoJSON
        for zone in safe_zones:
            if zone.geometry is None and zone.data:
                try:
                    meta = json.loads(zone.data) if isinstance(zone.data, str) else zone.data
                    bounds = meta.get("bounds", {})
                    if bounds:
                        # Create Polygon from bounds (rectangle)
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
                                [minLon, minLat]  # Close the polygon
                            ]]
                        }
                except (json.JSONDecodeError, AttributeError, KeyError):
                    pass
        
        return safe_zones
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching safe zones: {str(e)}")


@router.get("/{zone_id}", response_model=SafeZoneResponse)
async def get_safe_zone(zone_id: int, db: AsyncSession = Depends(get_db)):
    """
    Get a specific safe zone by ID.
    """
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    safe_zone = result.scalar_one_or_none()

    if not safe_zone:
        raise HTTPException(status_code=404, detail=f"Safe zone {zone_id} not found")

    return safe_zone
