"""ZoneNeed model — GS-053 safe-zone needs intake."""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base


class ZoneNeed(Base):
    __tablename__ = "zone_needs"

    id = Column(Integer, primary_key=True)
    safe_zone_id = Column(Integer, nullable=False)
    item_id = Column(Integer, nullable=True)
    item_name_free = Column(String(255), nullable=True)
    quantity_needed = Column(Integer, nullable=False)
    priority = Column(String(20), nullable=False, default="normal")
    reported_by = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False, default="open")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<ZoneNeed id={self.id} zone={self.safe_zone_id} status='{self.status}'>"
