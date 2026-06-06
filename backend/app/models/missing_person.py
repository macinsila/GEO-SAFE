"""
Kayıp kişi bildirimi modeli (GS-041).

Gizlilik: kesin konum (enlem/boylam) saklanmaz; yalnızca mahalle/ilçe adı tutulur.
Status akışı: active → found | removed  (soft-delete, veri silinmez)
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base


class MissingPerson(Base):
    __tablename__ = "missing_persons"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    age = Column(Integer, nullable=True)
    last_seen_district = Column(String(200), nullable=False)
    last_seen_description = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    contact_info = Column(String(500), nullable=True)
    reported_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # 'active' | 'found' | 'removed'
    status = Column(String(50), nullable=False, default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True, onupdate=func.now())

    def __repr__(self) -> str:
        return f"<MissingPerson id={self.id} name='{self.name}' status='{self.status}'>"
