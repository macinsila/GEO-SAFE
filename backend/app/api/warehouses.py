"""
Warehouse API endpoints
GET /warehouses - List all warehouses with their locations
"""

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.elements import WKBElement, WKTElement
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.observability import collector
from app.api.response import success_response
from app.core import cache
from app.core.audit import log_audit
from app.db import get_db
from app.models import Warehouse
from app.models.inventory_movement import InventoryMovement
from app.models.item import Item
from app.models.user import User
from app.models.warehouse_inventory import WarehouseInventory
from app.schemas import WarehouseCreate

_CACHE_KEY = "warehouses:list"
_CACHE_TTL = 300

DEFAULT_LOW_STOCK_THRESHOLD = 10


class InventoryUpdateItem(BaseModel):
    item_id: int
    quantity: int = Field(ge=0)


class InventoryUpdatePayload(BaseModel):
    items: List[InventoryUpdateItem]

router = APIRouter(tags=["warehouses"])


def _serialize_warehouse(warehouse: Warehouse, *, include_private: bool = False) -> dict:
    location_payload = None

    if warehouse.location is not None:
        try:
            if isinstance(warehouse.location, dict):
                location_payload = warehouse.location
            elif isinstance(warehouse.location, WKBElement):
                point = to_shape(warehouse.location)
                location_payload = {
                    "type": "Point",
                    "coordinates": [point.x, point.y],
                }
        except Exception:
            location_payload = None

    if location_payload is None and warehouse.data:
        try:
            meta = json.loads(warehouse.data) if isinstance(warehouse.data, str) else warehouse.data
            loc = meta.get("location", {})
            if loc:
                location_payload = {
                    "type": "Point",
                    "coordinates": [loc.get("lon", 0), loc.get("lat", 0)],
                }
        except (json.JSONDecodeError, AttributeError, KeyError):
            location_payload = None

    payload = {
        "id": warehouse.id,
        "name": warehouse.name,
        "capacity": warehouse.capacity,
        "status": warehouse.status,
        "location": location_payload,
        "created_at": warehouse.created_at,
    }
    if include_private:
        payload["address"] = warehouse.address
        payload["data"] = warehouse.data
    return payload


@router.get("")
async def list_warehouses(db: AsyncSession = Depends(get_db)):
    try:
        cached = await cache.get(_CACHE_KEY)
        if cached is not None:
            collector.record_cache_hit("warehouses")
            return success_response(data=cached, message="Warehouses listed")

        collector.record_cache_miss("warehouses")
        stmt = select(Warehouse).order_by(Warehouse.id)
        result = await db.execute(stmt)
        warehouses = result.scalars().all()
        data = [_serialize_warehouse(warehouse) for warehouse in warehouses]
        await cache.set(_CACHE_KEY, data, ttl=_CACHE_TTL)
        return success_response(data=data, message="Warehouses listed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching warehouses: {str(e)}")


@router.get("/admin")
async def list_warehouses_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    stmt = select(Warehouse).order_by(Warehouse.id)
    result = await db.execute(stmt)
    warehouses = result.scalars().all()
    return success_response(
        data=[_serialize_warehouse(warehouse, include_private=True) for warehouse in warehouses],
        message="Admin warehouses listed",
    )


@router.get("/{warehouse_id}")
async def get_warehouse(warehouse_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Warehouse).where(Warehouse.id == warehouse_id)
    result = await db.execute(stmt)
    warehouse = result.scalar_one_or_none()

    if not warehouse:
        raise HTTPException(status_code=404, detail=f"Warehouse {warehouse_id} not found")

    return success_response(data=_serialize_warehouse(warehouse), message="Warehouse fetched")


@router.post("", status_code=201)
async def create_warehouse(
    payload: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    lon = payload.location["coordinates"][0]
    lat = payload.location["coordinates"][1]

    warehouse = Warehouse(
        name=payload.name,
        address=payload.address,
        capacity=payload.capacity,
        status=payload.status,
        location=WKTElement(f"POINT({lon} {lat})", srid=4326),
        data={"location": {
            "lon": lon,
            "lat": lat
        }}
    )
    db.add(warehouse)
    await db.flush()
    await db.refresh(warehouse)
    await log_audit(db, "create", "warehouse", warehouse.id, new_value={"name": payload.name, "status": payload.status}, actor=current_user)
    await db.commit()
    await cache.delete(_CACHE_KEY)
    collector.record_cache_invalidation("warehouses")
    return success_response(data=_serialize_warehouse(warehouse, include_private=True), message="Warehouse created")


@router.put("/{warehouse_id}")
async def update_warehouse(
    warehouse_id: int,
    payload: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    stmt = select(Warehouse).where(Warehouse.id == warehouse_id)
    result = await db.execute(stmt)
    warehouse = result.scalar_one_or_none()

    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse bulunamadı")

    lon = payload.location["coordinates"][0]
    lat = payload.location["coordinates"][1]

    warehouse.name = payload.name
    warehouse.address = payload.address
    warehouse.capacity = payload.capacity
    warehouse.status = payload.status
    warehouse.location = WKTElement(f"POINT({lon} {lat})", srid=4326)
    warehouse.data = {"location": {
        "lon": lon,
        "lat": lat
    }}

    await db.flush()
    await db.refresh(warehouse)
    await log_audit(db, "update", "warehouse", warehouse_id, new_value={"name": payload.name, "status": payload.status}, actor=current_user)
    await db.commit()
    await cache.delete(_CACHE_KEY)
    collector.record_cache_invalidation("warehouses")
    return success_response(data=_serialize_warehouse(warehouse, include_private=True), message="Warehouse updated")


@router.delete("/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    stmt = select(Warehouse).where(Warehouse.id == warehouse_id)
    result = await db.execute(stmt)
    warehouse = result.scalar_one_or_none()

    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse bulunamadı")

    await log_audit(db, "delete", "warehouse", warehouse_id, old_value={"name": warehouse.name}, actor=current_user)
    await db.delete(warehouse)
    await db.commit()
    await cache.delete(_CACHE_KEY)
    collector.record_cache_invalidation("warehouses")
    return success_response(data={"id": warehouse_id}, message="Warehouse deleted")


@router.get("/{warehouse_id}/inventory")
async def get_warehouse_inventory(warehouse_id: int, db: AsyncSession = Depends(get_db)):
    wh_result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = wh_result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse bulunamadı")

    stmt = (
        select(
            WarehouseInventory.id,
            WarehouseInventory.item_id,
            WarehouseInventory.quantity,
            Item.name.label("item_name"),
            Item.sku.label("item_sku"),
            Item.unit.label("item_unit"),
            Item.low_stock_threshold.label("item_threshold"),
        )
        .join(Item, Item.id == WarehouseInventory.item_id)
        .where(WarehouseInventory.warehouse_id == warehouse_id)
        .order_by(Item.name)
    )
    result = await db.execute(stmt)
    rows = result.all()

    capacity = warehouse.capacity or 1
    items = []
    for row in rows:
        pct = round(row.quantity / capacity * 100, 1)
        items.append({
            "id": row.id,
            "item_id": row.item_id,
            "item_name": row.item_name,
            "item_sku": row.item_sku,
            "item_unit": row.item_unit,
            "quantity": row.quantity,
            "threshold": row.item_threshold if row.item_threshold is not None else DEFAULT_LOW_STOCK_THRESHOLD,
            "capacity_pct": pct,
            "low_stock": row.quantity <= (
                row.item_threshold if row.item_threshold is not None else DEFAULT_LOW_STOCK_THRESHOLD
            ),
        })

    return success_response(
        data={"warehouse_id": warehouse_id, "capacity": capacity, "items": items},
        message="Warehouse inventory fetched",
    )


@router.put("/{warehouse_id}/inventory")
async def update_warehouse_inventory(
    warehouse_id: int,
    payload: InventoryUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    wh_result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    if not wh_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Warehouse bulunamadı")

    performed_by = current_user.id
    user_result = await db.execute(select(User.id).where(User.id == current_user.id))
    if user_result.scalar_one_or_none() is None:
        performed_by = None

    for upd in payload.items:
        item_result = await db.execute(select(Item).where(Item.id == upd.item_id))
        if item_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail=f"Item {upd.item_id} not found")

        result = await db.execute(
            select(WarehouseInventory).where(
                and_(
                    WarehouseInventory.warehouse_id == warehouse_id,
                    WarehouseInventory.item_id == upd.item_id,
                )
            )
        )
        inv = result.scalar_one_or_none()
        previous_quantity = 0
        if inv is None:
            inv = WarehouseInventory(
                warehouse_id=warehouse_id, item_id=upd.item_id, quantity=upd.quantity
            )
            db.add(inv)
        else:
            previous_quantity = inv.quantity
            inv.quantity = upd.quantity

        db.add(
            InventoryMovement(
                item_id=upd.item_id,
                quantity=upd.quantity - previous_quantity,
                to_warehouse_id=warehouse_id,
                movement_type="adjustment",
                performed_by=performed_by,
                note="Warehouse inventory set",
                data={
                    "previous_quantity": previous_quantity,
                    "new_quantity": upd.quantity,
                },
            )
        )

    await db.commit()
    return success_response(data={"warehouse_id": warehouse_id}, message="Envanter güncellendi")
