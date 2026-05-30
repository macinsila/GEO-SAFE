"""VolunteerTask model — GS-050 volunteer task board."""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base


class VolunteerTask(Base):
    __tablename__ = "volunteer_tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    skill_required = Column(String(100), nullable=True)
    urgency = Column(String(20), nullable=False, default="medium")
    status = Column(String(20), nullable=False, default="open")
    assigned_to_id = Column(Integer, nullable=True)
    created_by_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<VolunteerTask id={self.id} status='{self.status}' urgency='{self.urgency}'>"
