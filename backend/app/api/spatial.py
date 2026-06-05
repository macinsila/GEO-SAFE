"""
Spatial query endpoints.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import Geometry, Geography

from app.api.auth import require_roles
from app.api.response import success_response
from app.api.rate_limit import nearest_depot_limiter
from app.db import get_db
from app.models.emergency_report import EmergencyReport
from app.models.item import Item
from app.models.safe_checkin import SafeCheckin
from app.models.safe_zone import SafeZone
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.warehouse_inventory import WarehouseInventory

router = APIRouter(tags=["spatial"])


@router.get("/nearest-depot")
async def nearest_depot_with_required_item(
    request: Request,
    lat: float = Query(..., ge=-90, le=90, description="User latitude"),
    lon: float = Query(..., ge=-180, le=180, description="User longitude"),
    item_name: str = Query(..., min_length=1, description="Required item name"),
    radius_km: float = Query(10.0, gt=0, description="Search radius in kilometers"),
    db: AsyncSession = Depends(get_db),
):
    """
    Find the nearest active depot that has the requested item in stock.
    Uses PostGIS ST_DWithin and ST_Distance over geography for meter-accurate distance.
    Rate limited: 20 requests / 60 seconds per IP.
    """
    await nearest_depot_limiter.check(request)
    try:
        cleaned_item_name = item_name.strip().lower()
        user_point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)

        # CAST is used intentionally to support deployments where the column type
        # may still be text before migration is applied.
        warehouse_point = cast(Warehouse.location, Geometry(geometry_type="POINT", srid=4326))
        warehouse_geog = cast(warehouse_point, Geography(geometry_type="POINT", srid=4326))
        user_geog = cast(user_point, Geography(geometry_type="POINT", srid=4326))

        distance_km_expr = (func.ST_Distance(warehouse_geog, user_geog) / 1000.0).label("distance_km")

        stmt = (
            select(
                Warehouse.id.label("warehouse_id"),
                Warehouse.name.label("warehouse_name"),
                Warehouse.status.label("status"),
                Item.id.label("item_id"),
                Item.name.label("item_name"),
                Item.unit.label("item_unit"),
                WarehouseInventory.quantity.label("item_quantity"),
                distance_km_expr,
            )
            .join(WarehouseInventory, WarehouseInventory.warehouse_id == Warehouse.id)
            .join(Item, Item.id == WarehouseInventory.item_id)
            .where(
                func.lower(Item.name) == cleaned_item_name,
                Warehouse.status == "active",
                WarehouseInventory.quantity > 0,
                func.ST_DWithin(warehouse_geog, user_geog, radius_km * 1000.0),
            )
            .order_by(distance_km_expr.asc())
            .limit(1)
        )

        result = await db.execute(stmt)
        nearest = result.first()

        if nearest is None:
            return success_response(
                data=[],
                message="No active depot found with requested item in the given radius",
            )

        row = nearest._mapping
        return success_response(
            data=[
                {
                    "depot": {
                        "id": row["warehouse_id"],
                        "name": row["warehouse_name"],
                        "status": row["status"],
                    },
                    "distance_km": round(float(row["distance_km"]), 3),
                    "item": {
                        "id": row["item_id"],
                        "name": row["item_name"],
                        "unit": row["item_unit"],
                        "quantity": int(row["item_quantity"]),
                    },
                }
            ],
            message="Nearest depot found",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Spatial nearest depot query failed: {str(exc)}",
        )


@router.get("/nearest-safe-zone")
async def nearest_safe_zone(
    lat: float = Query(..., ge=-90, le=90, description="User latitude"),
    lon: float = Query(..., ge=-180, le=180, description="User longitude"),
    limit: int = Query(default=5, ge=1, le=20, description="Max results"),
    db: AsyncSession = Depends(get_db),
):
    """
    GS-031 — Capacity-aware nearest safe zone lookup.

    Returns safe zones ordered by distance. Zones with status='full' are
    included but de-prioritised (sorted after non-full zones). Zones with
    status='inactive' or 'closed' are excluded entirely.

    Falls back to a non-spatial distance calculation when the safe_zone
    location column is NULL (e.g. SQLite / missing geometry migrations).
    """
    try:
        user_point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        sz_point = cast(SafeZone.location, Geometry(geometry_type="POINT", srid=4326))
        sz_geog = cast(sz_point, Geography(geometry_type="POINT", srid=4326))
        user_geog = cast(user_point, Geography(geometry_type="POINT", srid=4326))
        distance_km_expr = (func.ST_Distance(sz_geog, user_geog) / 1000.0).label("distance_km")

        stmt = (
            select(
                SafeZone.id,
                SafeZone.name,
                SafeZone.capacity,
                SafeZone.status,
                distance_km_expr,
            )
            .where(SafeZone.location.isnot(None))
            .where(SafeZone.status.notin_(["inactive", "closed"]))
            .order_by(
                # full zones sorted last; within same group sort by distance
                (SafeZone.status == "full").asc(),
                distance_km_expr.asc(),
            )
            .limit(limit)
        )

        result = await db.execute(stmt)
        rows = result.all()

        return success_response(
            data=[
                {
                    "id": r.id,
                    "name": r.name,
                    "capacity": r.capacity,
                    "status": r.status,
                    "distance_km": round(float(r.distance_km), 3),
                    "is_full": r.status == "full",
                }
                for r in rows
            ],
            message=f"{len(rows)} safe zone found",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Nearest safe zone query failed: {str(exc)}",
        )


# ── GS-063 — Demand/incident heatmap ────────────────────────────────────────

_INCIDENT_WEIGHTS = {"verified": 1.0, "reviewing": 0.7, "new": 0.5}


@router.get("/heatmap")
async def incident_heatmap(
    source: str = Query("incidents", description="incidents | checkins | both"),
    days: int = Query(30, ge=1, le=365, description="Include records from the last N days"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    """
    GS-063 — Returns heatmap intensity points as [[lat, lon, weight], ...].
    Incidents are weighted by status; check-ins carry uniform weight 0.5.
    Records marked spam/dismissed are excluded.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    points: list[tuple[float, float, float]] = []

    if source in ("incidents", "both"):
        result = await db.execute(
            select(EmergencyReport.enlem, EmergencyReport.boylam, EmergencyReport.status)
            .where(EmergencyReport.created_at >= since)
            .where(EmergencyReport.status.notin_(["spam", "dismissed"]))
        )
        for row in result.all():
            lat, lon, status = row.enlem, row.boylam, row.status
            if lat is None or lon is None:
                continue
            points.append((lat, lon, _INCIDENT_WEIGHTS.get(status, 0.5)))

    if source in ("checkins", "both"):
        result = await db.execute(
            select(SafeCheckin.lat, SafeCheckin.lon)
            .where(SafeCheckin.created_at >= since)
            .where(SafeCheckin.lat.isnot(None))
            .where(SafeCheckin.lon.isnot(None))
        )
        for row in result.all():
            points.append((row.lat, row.lon, 0.5))

    return success_response(
        data=points,
        message=f"{len(points)} heatmap point(s) returned",
    )
