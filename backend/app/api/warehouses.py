"""
Warehouse API endpoints
GET /warehouses - List all warehouses with their locations
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm.attributes import flag_modified
from geoalchemy2.elements import WKBElement, WKTElement
from geoalchemy2.shape import to_shape
from pydantic import BaseModel
from typing import List

from app.db import get_db
from app.models import Warehouse
from app.models.item import Item
from app.models.warehouse_inventory import WarehouseInventory
from app.schemas import WarehouseCreate
from app.api.auth import require_roles
from app.api.response import success_response
from app.models.user import User


class InventoryUpdateItem(BaseModel):
    item_id: int
    quantity: int


class InventoryUpdatePayload(BaseModel):
    items: List[InventoryUpdateItem]

router = APIRouter(tags=["warehouses"])


def _serialize_warehouse(warehouse: Warehouse) -> dict:
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

    return {
        "id": warehouse.id,
        "name": warehouse.name,
        "address": warehouse.address,
        "capacity": warehouse.capacity,
        "status": warehouse.status,
        "location": location_payload,
        "data": warehouse.data,
        "created_at": warehouse.created_at,
    }


@router.get("")
async def list_warehouses(db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(Warehouse).order_by(Warehouse.id)
        result = await db.execute(stmt)
        warehouses = result.scalars().all()

        return success_response(
            data=[_serialize_warehouse(warehouse) for warehouse in warehouses],
            message="Warehouses listed",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching warehouses: {str(e)}")


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
    await db.commit()
    await db.refresh(warehouse)
    return success_response(data=_serialize_warehouse(warehouse), message="Warehouse created")


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

    await db.commit()
    await db.refresh(warehouse)
    return success_response(data=_serialize_warehouse(warehouse), message="Warehouse updated")


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

    await db.delete(warehouse)
    await db.commit()
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
            "capacity_pct": pct,
            "low_stock": pct < 20,
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

    for upd in payload.items:
        result = await db.execute(
            select(WarehouseInventory).where(
                and_(
                    WarehouseInventory.warehouse_id == warehouse_id,
                    WarehouseInventory.item_id == upd.item_id,
                )
            )
        )
        inv = result.scalar_one_or_none()
        if inv is None:
            inv = WarehouseInventory(
                warehouse_id=warehouse_id, item_id=upd.item_id, quantity=upd.quantity
            )
            db.add(inv)
        else:
            inv.quantity = upd.quantity

    await db.commit()
    return success_response(data={"warehouse_id": warehouse_id}, message="Envanter güncellendi")