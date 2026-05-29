import asyncio
import time
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import push
from app.api.auth import get_current_user, require_roles
from app.api.response import success_response
from app.core.eq_notify import dispatch_earthquake_notifications
from app.db import get_db
from app.models.earthquake_notification_pref import EarthquakeNotificationPref
from app.models.user import User

router = APIRouter(tags=["earthquakes"])

# ── In-memory TTL cache ───────────────────────────────────────────────────────
_CACHE_TTL_SECONDS = 300  # 5 minutes — refreshes without hammering upstream
_cache_lock = asyncio.Lock()
_cached_payload: dict | None = None
_cache_expires_at: float = 0.0

KANDILLI_BASE = "https://api.orhanaydogdu.com.tr/deprem/kandilli/archive"
MAGNITUDE_THRESHOLD = 3.5
LOOKBACK_DAYS = 3


def _extract_coords(eq: dict) -> tuple[Optional[float], Optional[float]]:
    """Kandilli kaydından (lat, lon) çıkar; geojson.coordinates [lon, lat] önce,
    yoksa üst düzey lat/lng. Bulunamazsa (None, None)."""
    geojson = eq.get("geojson") or {}
    coords = geojson.get("coordinates")
    if isinstance(coords, (list, tuple)) and len(coords) >= 2:
        try:
            return float(coords[1]), float(coords[0])
        except (TypeError, ValueError):
            pass
    try:
        lat = eq.get("lat")
        lon = eq.get("lng", eq.get("lon"))
        if lat is not None and lon is not None:
            return float(lat), float(lon)
    except (TypeError, ValueError):
        pass
    return None, None


async def _fetch_fresh() -> dict:
    """Fetch the last LOOKBACK_DAYS of earthquake data from Kandilli and filter."""
    all_results: list[dict] = []
    fetch_errors: list[str] = []

    async with httpx.AsyncClient(timeout=15) as client:
        for i in range(LOOKBACK_DAYS):
            date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            try:
                response = await client.get(f"{KANDILLI_BASE}?date={date}&limit=500")
                response.raise_for_status()
                data = response.json()
                all_results.extend(data.get("result", []))
            except Exception as exc:
                fetch_errors.append(f"{date}: {exc}")

    cutoff = datetime.now() - timedelta(days=LOOKBACK_DAYS)
    filtered: list[dict] = []
    for eq in all_results:
        try:
            mag = float(eq["mag"])
            eq_date = datetime.strptime(eq["date_time"], "%Y-%m-%d %H:%M:%S")
            if mag >= MAGNITUDE_THRESHOLD and eq_date >= cutoff:
                lat, lon = _extract_coords(eq)
                filtered.append({
                    "mag": mag,
                    "title": eq["title"],
                    "date": eq["date_time"],
                    "depth": eq["depth"],
                    "lat": lat,
                    "lon": lon,
                })
        except (KeyError, TypeError, ValueError):
            continue

    filtered.sort(key=lambda x: x["date"], reverse=True)
    return {"result": filtered, "partial_errors": fetch_errors}


@router.get("")
async def get_earthquakes():
    global _cached_payload, _cache_expires_at

    now = time.monotonic()

    async with _cache_lock:
        if _cached_payload is not None and now < _cache_expires_at:
            return success_response(
                data={**_cached_payload, "cached": True},
                message="Earthquake feed (cached)",
            )

        try:
            payload = await _fetch_fresh()
            _cached_payload = payload
            _cache_expires_at = now + _CACHE_TTL_SECONDS
            return success_response(data=payload, message="Earthquake feed fetched")
        except Exception as exc:
            if _cached_payload is not None:
                return success_response(
                    data={**_cached_payload, "cached": True, "stale": True},
                    message=f"Upstream error — serving stale cache: {exc}",
                )
            return {
                "status": "error",
                "data": {"result": []},
                "message": f"Earthquake feed failed: {exc}",
            }


# ── Bildirim tercihleri (GS-100) ────────────────────────────────────────────

_DEFAULT_MIN_MAGNITUDE = 4.0


class EarthquakePreferenceUpdate(BaseModel):
    """PUT gövdesi — tam temsil; verilmeyen alanlar varsayılana döner."""

    enabled: bool = True
    min_magnitude: float = Field(default=_DEFAULT_MIN_MAGNITUDE, ge=0, le=10)
    max_depth_km: Optional[float] = Field(default=None, ge=0)
    reference_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    reference_lon: Optional[float] = Field(default=None, ge=-180, le=180)
    radius_km: Optional[float] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def _require_reference_with_radius(self) -> "EarthquakePreferenceUpdate":
        if self.radius_km is not None and (
            self.reference_lat is None or self.reference_lon is None
        ):
            raise ValueError(
                "radius_km verildiğinde reference_lat ve reference_lon zorunludur"
            )
        return self


class EarthquakePreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    user_id: int
    enabled: bool
    min_magnitude: float
    max_depth_km: Optional[float] = None
    reference_lat: Optional[float] = None
    reference_lon: Optional[float] = None
    radius_km: Optional[float] = None


def _default_preference_response(user_id: int) -> dict:
    return EarthquakePreferenceResponse(
        id=None,
        user_id=user_id,
        enabled=True,
        min_magnitude=_DEFAULT_MIN_MAGNITUDE,
    ).model_dump()


@router.get("/preferences")
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EarthquakeNotificationPref).where(
            EarthquakeNotificationPref.user_id == current_user.id
        )
    )
    pref = result.scalars().first()
    if pref is None:
        return success_response(
            data=_default_preference_response(current_user.id),
            message="Varsayılan deprem bildirim tercihleri",
        )
    return success_response(
        data=EarthquakePreferenceResponse.model_validate(pref).model_dump(),
        message="Deprem bildirim tercihleri",
    )


@router.put("/preferences")
async def upsert_preferences(
    payload: EarthquakePreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EarthquakeNotificationPref).where(
            EarthquakeNotificationPref.user_id == current_user.id
        )
    )
    pref = result.scalars().first()

    if pref is None:
        pref = EarthquakeNotificationPref(user_id=current_user.id)
        db.add(pref)

    pref.enabled = payload.enabled
    pref.min_magnitude = payload.min_magnitude
    pref.max_depth_km = payload.max_depth_km
    pref.reference_lat = payload.reference_lat
    pref.reference_lon = payload.reference_lon
    pref.radius_km = payload.radius_km

    await db.flush()
    pref_id = pref.id
    await db.commit()

    result = await db.execute(
        select(EarthquakeNotificationPref).where(EarthquakeNotificationPref.id == pref_id)
    )
    pref = result.scalar_one()
    return success_response(
        data=EarthquakePreferenceResponse.model_validate(pref).model_dump(),
        message="Deprem bildirim tercihleri kaydedildi",
    )


# ── Eşleştirme & sevkiyat (GS-101) ───────────────────────────────────────────

@router.post("/dispatch-notifications")
async def dispatch_notifications(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """Bir tarama turu: güncel depremleri kullanıcı tercihleriyle eşleştirip
    eşleşen kullanıcılara Web Push gönderir. Harici zamanlayıcı/admin tetikler."""
    if not push._vapid_configured():
        raise HTTPException(
            status_code=503,
            detail="VAPID anahtarları yapılandırılmamış (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)",
        )

    feed = await _fetch_fresh()
    earthquakes = feed.get("result", [])
    summary = await dispatch_earthquake_notifications(db, earthquakes)
    return success_response(data=summary, message="Deprem bildirim taraması tamamlandı")
