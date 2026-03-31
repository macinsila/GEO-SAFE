"""
Warehouse API endpoints
GET /warehouses - List all warehouses with their locations
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.models import Warehouse
from app.schemas import WarehouseResponse, WarehouseCreate
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(tags=["warehouses"])


@router.get("", response_model=list[WarehouseResponse])
async def list_warehouses(db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(Warehouse).order_by(Warehouse.id)
        result = await db.execute(stmt)
        warehouses = result.scalars().all()

        for warehouse in warehouses:
            if warehouse.location is None and warehouse.data:
                try:
                    meta = json.loads(warehouse.data) if isinstance(warehouse.data, str) else warehouse.data
                    loc = meta.get("location", {})
                    if loc:
                        warehouse.location = {
                            "type": "Point",
                            "coordinates": [loc.get("lon", 0), loc.get("lat", 0)]
                        }
                except (json.JSONDecodeError, AttributeError, KeyError):
                    pass

        return warehouses
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching warehouses: {str(e)}")


@router.get("/{warehouse_id}", response_model=WarehouseResponse)
async def get_warehouse(warehouse_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Warehouse).where(Warehouse.id == warehouse_id)
    result = await db.execute(stmt)
    warehouse = result.scalar_one_or_none()

    if not warehouse:
        raise HTTPException(status_code=404, detail=f"Warehouse {warehouse_id} not found")

    return warehouse


@router.post("", response_model=WarehouseResponse, status_code=201)
async def create_warehouse(
    payload: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    warehouse = Warehouse(
        name=payload.name,
        address=payload.address,
        capacity=payload.capacity,
        status=payload.status,
        data={"location": {
            "lon": payload.location["coordinates"][0],
            "lat": payload.location["coordinates"][1]
        }}
    )
    db.add(warehouse)
    await db.commit()
    await db.refresh(warehouse)
    return warehouse


@router.put("/{warehouse_id}", response_model=WarehouseResponse)
async def update_warehouse(
    warehouse_id: int,
    payload: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Warehouse).where(Warehouse.id == warehouse_id)
    result = await db.execute(stmt)
    warehouse = result.scalar_one_or_none()

    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse bulunamadı")

    warehouse.name = payload.name
    warehouse.address = payload.address
    warehouse.capacity = payload.capacity
    warehouse.status = payload.status
    warehouse.data = {"location": {
        "lon": payload.location["coordinates"][0],
        "lat": payload.location["coordinates"][1]
    }}

    await db.commit()
    await db.refresh(warehouse)
    return warehouse


@router.delete("/{warehouse_id}", status_code=204)
async def delete_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Warehouse).where(Warehouse.id == warehouse_id)
    result = await db.execute(stmt)
    warehouse = result.scalar_one_or_none()

    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse bulunamadı")

    await db.delete(warehouse)
    await db.commit()