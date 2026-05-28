"""SafeCheckin model — GS-040 'I am safe' check-in."""

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base


class SafeCheckin(Base):
    __tablename__ = "safe_checkins"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)
    name = Column(String(255), nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    note = Column(Text, nullable=True)
    source = Column(String(50), nullable=False, default="online")
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self) -> str:
        return f"<SafeCheckin id={self.id} user_id={self.user_id}>"
