"""
WarehouseInventory Model
Link table between Warehouse and Item.
Tracks current stock at each warehouse.
"""

from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func

from .base import Base


class WarehouseInventory(Base):
    __tablename__ = "warehouse_inventory"

    id = Column(Integer, primary_key=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, default=0, comment="Current stock quantity")
    
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<WarehouseInventory warehouse_id={self.warehouse_id} item_id={self.item_id} qty={self.quantity}>"
