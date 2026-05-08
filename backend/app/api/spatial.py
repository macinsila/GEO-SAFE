"""
Spatial query endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import Geometry, Geography

from app.api.response import success_response
from app.api.rate_limit import nearest_depot_limiter
from app.db import get_db
from app.models.item import Item
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
                Warehouse.address.label("address"),
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
                        "address": row["address"],
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
