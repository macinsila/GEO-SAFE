"""
Warehouse Model
Represents logistics depots where supplies are stored.
Uses PostGIS geometry(Point,4326) to store a single coordinate.

Geometry type = Point (a single lon/lat pair)
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from geoalchemy2 import Geometry

from .base import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    
    # PostGIS geometry: Point in lat/lon (SRID 4326)
    # Stores a single (longitude, latitude) coordinate
    # nullable=True for SQLite compatibility (no PostGIS support)
    location = Column(Geometry(geometry_type="Point", srid=4326), nullable=True)
    
    address = Column(String(500), nullable=True)
    capacity = Column(Integer, nullable=True, comment="Max storage capacity (e.g., tons)")
    status = Column(String(50), default="active", comment="active, inactive, maintenance")
    
    # Flexible metadata (e.g., operating hours, manager contact, equipment type)
    data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Warehouse id={self.id} name='{self.name}' address='{self.address}'>"
