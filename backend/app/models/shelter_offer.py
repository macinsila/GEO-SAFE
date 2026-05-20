"""
Shelter Offer Model
Stores housing support offers (non-public address detail).
"""

from sqlalchemy import Column, Integer, String, Date, DateTime
from sqlalchemy.sql import func

from .base import Base


class ShelterOffer(Base):
    __tablename__ = "shelter_offers"

    id = Column(Integer, primary_key=True)
    host_name = Column(String(255), nullable=False)
    contact_info = Column(String(255), nullable=False)
    city = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True)
    neighborhood = Column(String(255), nullable=True)
    address_detail = Column(String(1000), nullable=True)
    capacity = Column(Integer, nullable=False)
    available_from = Column(Date, nullable=True)
    available_until = Column(Date, nullable=True)
    duration_note = Column(String(500), nullable=True)
    household_notes = Column(String(500), nullable=True)
    suitability_notes = Column(String(500), nullable=True)
    status = Column(String(50), default="pending", nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<ShelterOffer id={self.id} status='{self.status}'>"
