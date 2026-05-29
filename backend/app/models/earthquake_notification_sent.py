"""
EarthquakeNotificationSent model — GS-101.

Dedup kaydı: bir kullanıcıya belirli bir deprem (eq_key) için bildirim
gönderildiğini işaretler; aynı depremin aynı kullanıcıya tekrar gönderilmesini
engeller. (user_id, eq_key) benzersizdir.
"""

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from .base import Base


class EarthquakeNotificationSent(Base):
    __tablename__ = "earthquake_notifications_sent"
    __table_args__ = (
        UniqueConstraint("user_id", "eq_key", name="uq_eq_notif_sent_user_key"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False, index=True)
    eq_key = Column(String(255), nullable=False, index=True)
    sent_at = Column(DateTime, server_default=func.now())

    def __repr__(self) -> str:
        return f"<EarthquakeNotificationSent user_id={self.user_id} eq_key={self.eq_key!r}>"
