"""
EarthquakeNotificationPref model — GS-100.

Kullanıcının deprem bildirim kuralları: minimum büyüklük, maksimum derinlik ve
referans noktaya mesafe (yarıçap). Kullanıcı başına tek satır (user_id unique).
"""

from sqlalchemy import Boolean, Column, DateTime, Float, Integer
from sqlalchemy.sql import func

from .base import Base


class EarthquakeNotificationPref(Base):
    __tablename__ = "earthquake_notification_prefs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False, unique=True, index=True)

    enabled = Column(Boolean, default=True, nullable=False)
    min_magnitude = Column(Float, default=4.0, nullable=False)
    max_depth_km = Column(Float, nullable=True)  # None = derinlik filtresi yok
    reference_lat = Column(Float, nullable=True)
    reference_lon = Column(Float, nullable=True)
    radius_km = Column(Float, nullable=True)  # None = mesafe filtresi yok

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return (
            f"<EarthquakeNotificationPref user_id={self.user_id} "
            f"min_mag={self.min_magnitude} radius_km={self.radius_km}>"
        )
