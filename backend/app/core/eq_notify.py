"""
Kullanıcı bazlı deprem bildirim motoru — GS-101.

Yeni depremleri tüm kullanıcı tercihleriyle eşleştirir, eşleşen kullanıcılara
Web Push gönderir ve (user_id, eq_key) dedup'ı ile aynı depremin aynı kullanıcıya
tekrar gönderilmesini engeller. Eşleştirme yüklemi GS-100'den gelir.
"""

from typing import Any, Awaitable, Callable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.eq_matching import earthquake_matches_preference
from app.models.earthquake_notification_pref import EarthquakeNotificationPref
from app.models.earthquake_notification_sent import EarthquakeNotificationSent
from app.models.push_subscription import PushSubscription

# sender imzası: (PushSubscription, payload_dict) -> bool (başarılı mı)
Sender = Callable[[PushSubscription, dict], Awaitable[bool]]


def earthquake_key(eq: dict) -> str:
    """Feed'de stabil ID yok; deterministik dedup anahtarı üret.

    Tercihen tarih+koordinat+büyüklük; koordinat yoksa başlık+tarih."""
    date = eq.get("date") or eq.get("date_time") or ""
    lat = eq.get("lat")
    lon = eq.get("lon")
    mag = eq.get("mag")
    if lat is not None and lon is not None:
        return f"{date}|{lat}|{lon}|{mag}"
    return f"{eq.get('title', '')}|{date}"


def find_matches(
    earthquakes: list[dict], prefs: list[Any]
) -> list[tuple[Any, dict]]:
    """Eşleşen (tercih, deprem) çiftlerini döndür (saf, yan etkisiz)."""
    matches: list[tuple[Any, dict]] = []
    for pref in prefs:
        for eq in earthquakes:
            if earthquake_matches_preference(eq, pref):
                matches.append((pref, eq))
    return matches


async def dispatch_earthquake_notifications(
    db: AsyncSession,
    earthquakes: list[dict],
    *,
    sender: Optional[Sender] = None,
) -> dict:
    """Bir tarama turu çalıştır: eşleştir, push gönder, dedup yaz, özet döndür."""
    if sender is None:
        from app.api.push import _send_one as sender  # geç import (test enjeksiyonu)

    summary = {
        "earthquakes": len(earthquakes),
        "matches": 0,
        "users_notified": 0,
        "push_sent": 0,
        "push_failed": 0,
        "skipped_already_sent": 0,
        "matched_no_subscription": 0,
    }

    prefs_result = await db.execute(
        select(EarthquakeNotificationPref).where(
            EarthquakeNotificationPref.enabled.is_(True)
        )
    )
    prefs = list(prefs_result.scalars().all())

    matches = find_matches(earthquakes, prefs)
    summary["matches"] = len(matches)
    if not matches:
        return summary

    # Bu turdaki anahtarlar için mevcut dedup kayıtlarını ön-yükle
    keys = {earthquake_key(eq) for _, eq in matches}
    sent_result = await db.execute(
        select(
            EarthquakeNotificationSent.user_id,
            EarthquakeNotificationSent.eq_key,
        ).where(EarthquakeNotificationSent.eq_key.in_(keys))
    )
    already_sent: set[tuple[int, str]] = {(row.user_id, row.eq_key) for row in sent_result}

    committed_any = False
    for pref, eq in matches:
        user_id = pref.user_id
        key = earthquake_key(eq)
        if (user_id, key) in already_sent:
            summary["skipped_already_sent"] += 1
            continue

        subs_result = await db.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id)
        )
        subs = list(subs_result.scalars().all())
        if not subs:
            summary["matched_no_subscription"] += 1
            continue

        payload = _build_payload(eq)
        any_success = False
        for sub in subs:
            ok = await sender(sub, payload)
            if ok:
                summary["push_sent"] += 1
                any_success = True
            else:
                summary["push_failed"] += 1

        if any_success:
            db.add(EarthquakeNotificationSent(user_id=user_id, eq_key=key))
            already_sent.add((user_id, key))
            summary["users_notified"] += 1
            committed_any = True

    if committed_any:
        await db.commit()

    return summary


def _build_payload(eq: dict) -> dict:
    mag = eq.get("mag")
    title = eq.get("title", "Deprem")
    depth = eq.get("depth")
    date = eq.get("date") or eq.get("date_time") or ""
    body_parts = [str(date)]
    if depth is not None:
        body_parts.append(f"Derinlik {depth} km")
    return {
        "title": f"Deprem M{mag} — {title}",
        "body": " · ".join(p for p in body_parts if p),
        "url": "/",
        "tag": "geosafe-earthquake",
    }
