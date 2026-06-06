"""
Announcement model — official published information for citizens.
"""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    kategori = Column(String(100), nullable=True)   # genel|uyari|tahliye|saglik|lojistik|guvenlik
    priority = Column(String(20), nullable=False, server_default="normal")  # low|normal|high|critical
    status = Column(String(50), nullable=False, server_default="draft")     # draft|published|archived
    created_by = Column(Integer, nullable=True)     # user id, intentionally no FK constraint
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Announcement id={self.id} title='{self.title[:40]}' status='{self.status}'>"
