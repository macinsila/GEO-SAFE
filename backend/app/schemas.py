"""
Pydantic schemas for request/response validation and serialization.
Includes custom JSON serialization for PostGIS geometries.
"""

from pydantic import BaseModel, Field, field_serializer, field_validator
from typing import Optional, Any
from datetime import datetime, date


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

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: dict) -> dict:
        coords = v.get("coordinates")
        if not isinstance(coords, list) or len(coords) < 2:
            raise ValueError("location.coordinates must be [lon, lat]")
        try:
            lon, lat = float(coords[0]), float(coords[1])
        except (TypeError, ValueError):
            raise ValueError("location.coordinates must contain numeric values")
        if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
            raise ValueError("location coordinates out of valid WGS84 range")
        return v


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
    description: Optional[str] = None
    low_stock_threshold: Optional[int] = Field(default=None, ge=0)
    is_active: bool = True


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class ItemResponse(ItemBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WarehouseInventoryAdminUpdate(BaseModel):
    quantity: int = Field(ge=0)
    movement_type: str = "adjustment"
    note: Optional[str] = None


class WarehouseInventoryAdminRow(BaseModel):
    warehouse_id: int
    warehouse_name: str
    item_id: int
    item_name: str
    item_sku: str
    item_unit: str
    quantity: int
    threshold: int
    is_critical: bool


class InventoryMovementAdminResponse(BaseModel):
    id: int
    warehouse_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    item_id: int
    item_name: str
    item_sku: str
    quantity_change: int
    old_quantity: Optional[int] = None
    new_quantity: Optional[int] = None
    movement_type: str
    note: Optional[str] = None
    created_at: datetime
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None


class CriticalStockResponse(BaseModel):
    warehouse_id: int
    warehouse_name: str
    item_id: int
    item_name: str
    item_sku: str
    item_unit: str
    quantity: int
    threshold: int
    recommended_action: str


# ===== User Schemas =====
from pydantic import EmailStr

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ===== Volunteer Schemas =====
class VolunteerCreate(BaseModel):
    full_name: str
    contact_info: str
    district: Optional[str] = None
    neighborhood: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    primary_role: Optional[str] = None
    availability_note: Optional[str] = None


class VolunteerPublicResponse(BaseModel):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class VolunteerAdminResponse(VolunteerPublicResponse):
    full_name: str
    contact_info: str
    district: Optional[str] = None
    neighborhood: Optional[str] = None
    skills: list[str] | None = None
    primary_role: Optional[str] = None
    availability_note: Optional[str] = None
    updated_at: Optional[datetime] = None


class VolunteerMatchCandidate(BaseModel):
    id: int
    full_name: str
    contact_info: str
    district: Optional[str] = None
    neighborhood: Optional[str] = None
    skills: list[str] | None = None
    primary_role: Optional[str] = None
    availability_note: Optional[str] = None

    class Config:
        from_attributes = True


# ===== Shelter Offer Schemas =====
class ShelterOfferCreate(BaseModel):
    host_name: str
    contact_info: str
    city: Optional[str] = None
    district: Optional[str] = None
    neighborhood: Optional[str] = None
    address_detail: Optional[str] = None
    capacity: int = Field(ge=1)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    duration_note: Optional[str] = None
    household_notes: Optional[str] = None
    suitability_notes: Optional[str] = None


class ShelterOfferPublicResponse(BaseModel):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ShelterOfferAdminResponse(ShelterOfferPublicResponse):
    host_name: str
    contact_info: str
    city: Optional[str] = None
    district: Optional[str] = None
    neighborhood: Optional[str] = None
    address_detail: Optional[str] = None
    capacity: int
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    duration_note: Optional[str] = None
    household_notes: Optional[str] = None
    suitability_notes: Optional[str] = None
    updated_at: Optional[datetime] = None


# ===== Sprint 3A — Status Update Schemas =====

_VOLUNTEER_STATUSES = {"pending", "approved", "rejected", "inactive"}
_SHELTER_STATUSES = {"pending", "approved", "rejected", "inactive"}
_EMERGENCY_STATUSES = {"new", "reviewing", "verified", "resolved", "dismissed", "spam"}


class VolunteerStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in _VOLUNTEER_STATUSES:
            raise ValueError(
                f"Invalid volunteer status '{v}'. Allowed: {sorted(_VOLUNTEER_STATUSES)}"
            )
        return v


class ShelterStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in _SHELTER_STATUSES:
            raise ValueError(
                f"Invalid shelter status '{v}'. Allowed: {sorted(_SHELTER_STATUSES)}"
            )
        return v


class EmergencyStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in _EMERGENCY_STATUSES:
            raise ValueError(
                f"Invalid emergency status '{v}'. Allowed: {sorted(_EMERGENCY_STATUSES)}"
            )
        return v


# ===== GS-050 — Volunteer Task Board =====

_TASK_URGENCIES = {"low", "medium", "high", "critical"}
_TASK_STATUSES = {"open", "in_progress", "done", "cancelled"}


class VolunteerTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    skill_required: Optional[str] = None
    urgency: str = "medium"

    @field_validator("urgency")
    @classmethod
    def validate_urgency(cls, v: str) -> str:
        if v not in _TASK_URGENCIES:
            raise ValueError(f"Invalid urgency '{v}'. Allowed: {sorted(_TASK_URGENCIES)}")
        return v


class VolunteerTaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    skill_required: Optional[str] = None
    urgency: str
    status: str
    assigned_to_id: Optional[int] = None
    created_by_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VolunteerTaskStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in _TASK_STATUSES:
            raise ValueError(f"Invalid task status '{v}'. Allowed: {sorted(_TASK_STATUSES)}")
        return v


class VolunteerTaskAssign(BaseModel):
    assigned_to_id: Optional[int] = None


class EmergencyAdminResponse(BaseModel):
    id: int
    durum: str
    kategori: Optional[str] = None
    aciklama: Optional[str] = None
    saat: str
    harita_link: Optional[str] = None
    enlem: float
    boylam: float
    status: str
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Announcement Schemas =====

_ANNOUNCEMENT_STATUSES = {"draft", "published", "archived"}
_ANNOUNCEMENT_CATEGORIES = {"genel", "uyari", "tahliye", "saglik", "lojistik", "guvenlik"}
_ANNOUNCEMENT_PRIORITIES = {"low", "normal", "high", "critical"}


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    kategori: Optional[str] = None
    priority: str = "normal"

    @field_validator("kategori")
    @classmethod
    def validate_kategori(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _ANNOUNCEMENT_CATEGORIES:
            raise ValueError(
                f"Geçersiz kategori '{v}'. İzin verilenler: {sorted(_ANNOUNCEMENT_CATEGORIES)}"
            )
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in _ANNOUNCEMENT_PRIORITIES:
            raise ValueError(
                f"Geçersiz öncelik '{v}'. İzin verilenler: {sorted(_ANNOUNCEMENT_PRIORITIES)}"
            )
        return v


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    kategori: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

    @field_validator("kategori")
    @classmethod
    def validate_kategori(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _ANNOUNCEMENT_CATEGORIES:
            raise ValueError(
                f"Geçersiz kategori '{v}'. İzin verilenler: {sorted(_ANNOUNCEMENT_CATEGORIES)}"
            )
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _ANNOUNCEMENT_PRIORITIES:
            raise ValueError(
                f"Geçersiz öncelik '{v}'. İzin verilenler: {sorted(_ANNOUNCEMENT_PRIORITIES)}"
            )
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _ANNOUNCEMENT_STATUSES:
            raise ValueError(
                f"Geçersiz durum '{v}'. İzin verilenler: {sorted(_ANNOUNCEMENT_STATUSES)}"
            )
        return v


class AnnouncementPublicResponse(BaseModel):
    id: int
    title: str
    content: str
    kategori: Optional[str] = None
    priority: str
    published_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AnnouncementAdminResponse(BaseModel):
    id: int
    title: str
    content: str
    kategori: Optional[str] = None
    priority: str
    status: str
    created_by: Optional[int] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
