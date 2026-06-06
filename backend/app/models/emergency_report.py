"""
Emergency Report Model
Stores incoming emergency notifications from citizens.
"""

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base


class EmergencyReport(Base):
    __tablename__ = "emergency_reports"

    id = Column(Integer, primary_key=True)
    durum = Column(String, nullable=False)
    saat = Column(String, nullable=False)
    harita_link = Column(String, nullable=True)
    enlem = Column(Float, nullable=False)
    boylam = Column(Float, nullable=False)
    kategori = Column(String(100), nullable=True)
    aciklama = Column(Text, nullable=True)
    status = Column(String(50), default="new", nullable=False)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self) -> str:
        return f"<EmergencyReport id={self.id} durum='{self.durum}' status='{self.status}'>"
