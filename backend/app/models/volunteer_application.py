"""
Volunteer Application Model
Stores volunteer intake requests (non-public).
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func

from .base import Base


class VolunteerApplication(Base):
    __tablename__ = "volunteer_applications"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(255), nullable=False)
    contact_info = Column(String(255), nullable=False)
    district = Column(String(255), nullable=True)
    neighborhood = Column(String(255), nullable=True)
    skills = Column(JSON, nullable=True)
    availability_note = Column(String(500), nullable=True)
    status = Column(String(50), default="pending", nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<VolunteerApplication id={self.id} status='{self.status}'>"
