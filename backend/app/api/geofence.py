"""
Coğrafi alan alarmları — GS-023.

GET  /api/v1/geofence/subscription  — kullanıcının geofence aboneliği (auth)
PUT  /api/v1/geofence/subscription  — abonelik upsert (auth)
POST /api/v1/geofence/dispatch      — bir olay için yakındaki abonelere alarm (admin)

Acil bildirim oluşturulduğunda (POST /api/v1/emergency) yakındaki aboneler
otomatik olarak uyarılır (best-effort, raporu bloklamaz) — bkz. app/api/emergency.py.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import push
from app.api.auth import get_current_user, require_roles
from app.api.response import success_response
from app.core.geofence import dispatch_geofenced_alert
from app.db import get_db
from app.models.geofence_subscription import GeofenceSubscription
from app.models.user import User

router = APIRouter(tags=["geofence"])

_DEFAULT_RADIUS_KM = 5.0


class GeofenceSubscriptionUpdate(BaseModel):
    """PUT gövdesi — tam temsil; verilmeyen alanlar varsayılana döner."""

    enabled: bool = True
    center_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    center_lon: Optional[float] = Field(default=None, ge=-180, le=180)
    radius_km: float = Field(default=_DEFAULT_RADIUS_KM, gt=0, le=500)

    @model_validator(mode="after")
    def _validate(self) -> "GeofenceSubscriptionUpdate":
        has_lat = self.center_lat is not None
        has_lon = self.center_lon is not None
        if has_lat != has_lon:
            raise ValueError("center_lat ve center_lon birlikte verilmelidir")
        if self.enabled and not has_lat:
            raise ValueError(
                "Alarm etkinken konum (center_lat, center_lon) zorunludur"
            )
        return self


class GeofenceSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    user_id: int
    enabled: bool
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    radius_km: float


class GeofenceDispatchPayload(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    title: str = Field(..., min_length=1, max_length=120)
    body: str = Field(..., min_length=1, max_length=300)
    url: str = Field(default="/", max_length=300)


def _default_response(user_id: int) -> dict:
    return GeofenceSubscriptionResponse(
        id=None,
        user_id=user_id,
        enabled=False,
        radius_km=_DEFAULT_RADIUS_KM,
    ).model_dump()


@router.get("/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GeofenceSubscription).where(
            GeofenceSubscription.user_id == current_user.id
        )
    )
    sub = result.scalars().first()
    if sub is None:
        return success_response(
            data=_default_response(current_user.id),
            message="Varsayılan geofence aboneliği",
        )
    return success_response(
        data=GeofenceSubscriptionResponse.model_validate(sub).model_dump(),
        message="Geofence aboneliği",
    )


@router.put("/subscription")
async def upsert_subscription(
    payload: GeofenceSubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GeofenceSubscription).where(
            GeofenceSubscription.user_id == current_user.id
        )
    )
    sub = result.scalars().first()

    if sub is None:
        sub = GeofenceSubscription(user_id=current_user.id)
        db.add(sub)

    sub.enabled = payload.enabled
    sub.center_lat = payload.center_lat
    sub.center_lon = payload.center_lon
    sub.radius_km = payload.radius_km

    await db.flush()
    sub_id = sub.id
    await db.commit()

    result = await db.execute(
        select(GeofenceSubscription).where(GeofenceSubscription.id == sub_id)
    )
    sub = result.scalar_one()
    return success_response(
        data=GeofenceSubscriptionResponse.model_validate(sub).model_dump(),
        message="Geofence aboneliği kaydedildi",
    )


@router.post("/dispatch")
async def dispatch(
    payload: GeofenceDispatchPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "operator")),
):
    """Bir olay konumu için yakındaki abonelere Web Push alarmı gönderir."""
    if not push._vapid_configured():
        raise HTTPException(
            status_code=503,
            detail="VAPID anahtarları yapılandırılmamış (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)",
        )

    summary = await dispatch_geofenced_alert(
        db,
        lat=payload.lat,
        lon=payload.lon,
        title=payload.title,
        body=payload.body,
        url=payload.url or "/",
    )
    return success_response(data=summary, message="Geofence alarm taraması tamamlandı")
