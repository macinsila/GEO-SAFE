"""
Pydantic schemas for request/response validation and serialization.
Includes custom JSON serialization for PostGIS geometries.
"""

from pydantic import BaseModel, field_serializer
from typing import Optional, Any
from datetime import datetime


# ===== SafeZone Schemas =====
class SafeZoneBase(BaseModel):
    name: str
    capacity: Optional[int] = None
    status: str = "active"


class SafeZoneCreate(SafeZoneBase):
    # Expected geometry as GeoJSON: {"type": "Polygon", "coordinates": [[[lon, lat], ...]]}
    geometry: dict


class SafeZoneResponse(SafeZoneBase):
    id: int
    geometry: Any = None  # PostGIS geometry object or None for SQLite
    data: Optional[Any] = None  # JSON metadata with zone bounds
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("geometry", when_used="json")
    def serialize_geometry(self, value: Any) -> dict:
        """
        Serialize PostGIS geometry to GeoJSON.
        For SQLite, geometry will be None and bounds are in data.bounds
        """
        if value is None:
            return None

        # If it's already a dict (GeoJSON), return as is
        if isinstance(value, dict):
            return value

        # If it's a string (likely WKT or JSON string), try to parse
        if isinstance(value, str):
            import json
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                # If it's WKT, return as string (frontend can handle)
                return {"type": "raw", "value": value}

        # If it's a GeoAlchemy2 geometry object, convert to dict
        if hasattr(value, "geom_type") and hasattr(value, "coords"):
            # This is a Shapely geometry
            geom_dict = value.__geo_interface__
            return geom_dict

        # Fallback: try __geo_interface__ (standard for geometry objects)
        if hasattr(value, "__geo_interface__"):
            return value.__geo_interface__

        return {"type": "unknown", "value": str(value)}


# ===== Warehouse Schemas =====
class WarehouseBase(BaseModel):
    name: str
    address: Optional[str] = None
    capacity: Optional[int] = None
    status: str = "active"


class WarehouseCreate(WarehouseBase):
    # Expected geometry as GeoJSON: {"type": "Point", "coordinates": [lon, lat]}
    location: dict


class WarehouseResponse(WarehouseBase):
    id: int
    location: Any = None  # PostGIS geometry object or None for SQLite
    data: Optional[Any] = None  # JSON metadata with location coordinates
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("location", when_used="json")
    def serialize_location(self, value: Any) -> dict:
        """
        Serialize PostGIS Point geometry to GeoJSON.
        For SQLite, location will be None and coordinates are in data.location
        """
        if value is None:
            return None

        # If it's already a dict (GeoJSON), return as is
        if isinstance(value, dict):
            return value

        # If it's a string (likely WKT or JSON string), try to parse
        if isinstance(value, str):
            import json
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return {"type": "raw", "value": value}

        # If it has __geo_interface__ (Shapely geometries)
        if hasattr(value, "__geo_interface__"):
            return value.__geo_interface__

        return {"type": "unknown", "value": str(value)}


# ===== Item Schemas =====
class ItemBase(BaseModel):
    sku: str
    name: str
    unit: str = "unit"


class ItemCreate(ItemBase):
    pass


class ItemResponse(ItemBase):
    id: int

    class Config:
        from_attributes = True


# ===== User Schemas =====
from pydantic import EmailStr

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str