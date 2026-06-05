"""
Coğrafi alan (geofence) eşleştirme + sevkiyat — GS-023.

Bir olay konumunu (lat, lon) kullanıcıların opt-in geofence aboneliğiyle eşleştirir
ve dairesi içine düşen kullanıcılara Web Push gönderir. Mesafe hesabı GS-100'deki
haversine yardımcısından gelir (tek doğruluk kaynağı).

Mahremiyet: yalnızca kullanıcının kendi verdiği kaba referans konumu kullanılır;
olay konumu bildirim gövdesine konmaz (sadece "yakınında" sinyali verilir).
"""

from typing import Any, Awaitable, Callable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.eq_matching import haversine_km
from app.models.geofence_subscription import GeofenceSubscription
from app.models.push_subscription import PushSubscription

# sender imzası: (PushSubscription, payload_dict) -> bool (başarılı mı)
Sender = Callable[[PushSubscription, dict], Awaitable[bool]]


def subscription_matches_incident(sub: Any, lat: float, lon: float) -> bool:
    """Olay (lat, lon) aboneliğin dairesi içinde mi? Saf, yan etkisiz.

    - sub.enabled False → eşleşmez
    - referans konum eksik → eşleşmez (opt-in zorunlu)
    - haversine(merkez, olay) > radius_km → eşleşmez
    """
    if not sub.enabled:
        return False
    if sub.center_lat is None or sub.center_lon is None:
        return False
    radius = sub.radius_km if sub.radius_km is not None else 0.0
    if radius <= 0:
        return False
    return haversine_km(sub.center_lat, sub.center_lon, lat, lon) <= radius


async def dispatch_geofenced_alert(
    db: AsyncSession,
    *,
    lat: float,
    lon: float,
    title: str,
    body: str,
    url: str = "/",
    tag: str = "geosafe-geofence",
    sender: Optional[Sender] = None,
) -> dict:
    """Olay konumunu tüm aboneliklerle eşleştir, eşleşen kullanıcılara push gönder.

    Eşleşen her kullanıcının tüm push aboneliklerine gönderilir. Özet döndürür.
    """
    if sender is None:
        from app.api.push import _send_one as sender  # geç import (test enjeksiyonu)

    summary = {
        "matched_subscriptions": 0,
        "users_notified": 0,
        "push_sent": 0,
        "push_failed": 0,
        "matched_no_push_subscription": 0,
    }

    subs_result = await db.execute(
        select(GeofenceSubscription).where(GeofenceSubscription.enabled.is_(True))
    )
    subs = list(subs_result.scalars().all())

    matched = [s for s in subs if subscription_matches_incident(s, lat, lon)]
    summary["matched_subscriptions"] = len(matched)
    if not matched:
        return summary

    payload = {"title": title, "body": body, "url": url, "tag": tag}

    for sub in matched:
        push_result = await db.execute(
            select(PushSubscription).where(PushSubscription.user_id == sub.user_id)
        )
        push_subs = list(push_result.scalars().all())
        if not push_subs:
            summary["matched_no_push_subscription"] += 1
            continue

        any_success = False
        for ps in push_subs:
            ok = await sender(ps, payload)
            if ok:
                summary["push_sent"] += 1
                any_success = True
            else:
                summary["push_failed"] += 1

        if any_success:
            summary["users_notified"] += 1

    return summary
