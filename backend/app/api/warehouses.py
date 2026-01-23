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
from app.schemas import WarehouseResponse

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])


@router.get("", response_model=list[WarehouseResponse])
async def list_warehouses(db: AsyncSession = Depends(get_db)):
    """
    List all warehouses with their locations.
    
    Returns a list of warehouse records with geometry in GeoJSON format.
    Each warehouse contains:
    - id: Unique identifier
    - name: Warehouse name
    - location: Point geometry in GeoJSON format {type: "Point", coordinates: [lon, lat]}
    - address: Physical address
    - capacity: Storage capacity
    - status: active/inactive/maintenance
    - created_at: Creation timestamp
    
    Example response:
    ```json
    [
      {
        "id": 1,
        "name": "Beyoğlu Supply Depot",
        "location": {"type": "Point", "coordinates": [28.9784, 41.0082]},
        "address": "Taksim District, Beyoğlu, Istanbul",
        "capacity": 500,
        "status": "active",
        "created_at": "2025-12-24T12:00:00"
      }
    ]
    ```
    """
    try:
        stmt = select(Warehouse).order_by(Warehouse.id)
        result = await db.execute(stmt)
        warehouses = result.scalars().all()
        
        # For SQLite: extract location from data JSON and create location GeoJSON
        for warehouse in warehouses:
            if warehouse.location is None and warehouse.data:
                try:
                    meta = json.loads(warehouse.data) if isinstance(warehouse.data, str) else warehouse.data
                    loc = meta.get("location", {})
                    if loc:
                        # Create GeoJSON Point from coordinates
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
    """
    Get a specific warehouse by ID.
    """
    stmt = select(Warehouse).where(Warehouse.id == warehouse_id)
    result = await db.execute(stmt)
    warehouse = result.scalar_one_or_none()

    if not warehouse:
        raise HTTPException(status_code=404, detail=f"Warehouse {warehouse_id} not found")

    return warehouse
