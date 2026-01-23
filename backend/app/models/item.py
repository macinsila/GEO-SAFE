"""
Item Model
Represents supply types (food, medicine, blankets, etc.).
"""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from .base import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True)
    sku = Column(String(100), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    unit = Column(String(50), default="unit", comment="unit, kg, liter, box, etc.")
    
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<Item id={self.id} sku='{self.sku}' name='{self.name}'>"
