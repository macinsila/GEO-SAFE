"""
InventoryMovement Model
Audit log for all inventory changes (in, out, transfers).
Tracks who, what, when, and why.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func

from .base import Base


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    
    from_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True, comment="NULL for incoming stock")
    to_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True, comment="NULL for outgoing stock")
    
    movement_type = Column(String(50), nullable=False, comment="in, out, transfer")
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    note = Column(String(500), nullable=True)
    data = Column(JSON, nullable=True)
    
    timestamp = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<InventoryMovement id={self.id} type='{self.movement_type}' qty={self.quantity}>"
