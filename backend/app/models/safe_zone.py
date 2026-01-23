"""
SafeZone Model
Represents safe gathering areas during disasters.
Uses PostGIS geometry(Polygon,4326) to store area boundaries.

SRID 4326 = WGS84 (latitude/longitude in decimal degrees)
Geometry type = Polygon (a closed ring of coordinates defining a boundary)
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from geoalchemy2 import Geometry

from .base import Base


class SafeZone(Base):
    __tablename__ = "safe_zones"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    
    # PostGIS geometry: Polygon in lat/lon (SRID 4326)
    # The app will store coordinates as GeoJSON or WKT
    # nullable=True for SQLite compatibility (no PostGIS support)
    geometry = Column(Geometry(geometry_type="Polygon", srid=4326), nullable=True)
    
    capacity = Column(Integer, nullable=True, comment="Max people this zone can accommodate")
    capacity_type = Column(String(50), default="persons", comment="persons, tons, etc.")
    status = Column(String(50), default="active", comment="active, inactive, closed")
    
    # Flexible metadata storage (e.g., opening hours, contacts, resources)
    data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SafeZone id={self.id} name='{self.name}' capacity={self.capacity}>"
