"""
GeofenceSubscription model — GS-023 Coğrafi alan alarmları.

Kullanıcının opt-in (rıza ile verdiği) yaklaşık konumu ve yarıçapı. Yakındaki bir
olay (acil bildirim / toplanma alanı değişimi) bu daire içindeyse kullanıcıya
Web Push gönderilir. Mahremiyet: sadece kullanıcının kendi verdiği kaba konum
saklanır; sürekli konum takibi yapılmaz. Kullanıcı başına tek satır (user_id unique).
"""

from sqlalchemy import Boolean, Column, DateTime, Float, Integer
from sqlalchemy.sql import func

from .base import Base


class GeofenceSubscription(Base):
    __tablename__ = "geofence_subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False, unique=True, index=True)

    enabled = Column(Boolean, default=True, nullable=False)
    # Kullanıcının opt-in referans konumu (kaba). None → eşleşme yapılmaz.
    center_lat = Column(Float, nullable=True)
    center_lon = Column(Float, nullable=True)
    # Bu yarıçap (km) içindeki olaylar bildirim tetikler.
    radius_km = Column(Float, default=5.0, nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return (
            f"<GeofenceSubscription user_id={self.user_id} "
            f"center=({self.center_lat},{self.center_lon}) radius_km={self.radius_km}>"
        )
