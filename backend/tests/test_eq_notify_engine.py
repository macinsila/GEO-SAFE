"""GS-101 — eşleştirme motoru, sevkiyat, dedup ve dispatch endpoint testleri."""

import os
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core import eq_notify
from app.core.eq_notify import earthquake_key, find_matches
from app.models.earthquake_notification_pref import EarthquakeNotificationPref
from app.models.earthquake_notification_sent import EarthquakeNotificationSent
from app.models.push_subscription import PushSubscription

# NullPool motor: Windows proactor loop'ta havuzlanmış asyncpg bağlantısının
# oturumlar/loop'lar arası yeniden kullanımından doğan teardown hatasını önler.
_engine = create_async_engine(os.environ["DATABASE_URL"], poolclass=NullPool)
AsyncSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)

IST_LAT, IST_LON = 41.0, 29.0


def _eq(mag=5.0, title="Test", date="2026-05-29 10:00:00", depth=7.0, lat=IST_LAT, lon=IST_LON):
    return {"mag": mag, "title": title, "date": date, "depth": depth, "lat": lat, "lon": lon}


def make_pref(user_id=1, **overrides):
    base = dict(
        user_id=user_id,
        enabled=True,
        min_magnitude=4.0,
        max_depth_km=None,
        reference_lat=None,
        reference_lon=None,
        radius_km=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


# ── earthquake_key ────────────────────────────────────────────────────────────

def test_earthquake_key_deterministic():
    eq = _eq()
    assert earthquake_key(eq) == earthquake_key(dict(eq))


def test_earthquake_key_differs_for_different_quakes():
    assert earthquake_key(_eq(mag=5.0)) != earthquake_key(_eq(mag=6.0))


def test_earthquake_key_fallback_without_coords():
    eq = {"title": "X", "date": "2026-05-29 10:00:00", "mag": 5.0, "lat": None, "lon": None}
    assert earthquake_key(eq) == "X|2026-05-29 10:00:00"


# ── find_matches (saf) ────────────────────────────────────────────────────────

def test_find_matches_separates_matching_from_non_matching():
    prefs = [make_pref(user_id=1, min_magnitude=4.0), make_pref(user_id=2, min_magnitude=9.0)]
    quakes = [_eq(mag=5.0)]
    matches = find_matches(quakes, prefs)
    assert len(matches) == 1
    assert matches[0][0].user_id == 1


# ── dispatch (DB + fake sender) ───────────────────────────────────────────────

async def _add(*objs):
    async with AsyncSessionLocal() as db:
        for o in objs:
            db.add(o)
        await db.commit()


def _real_pref(user_id, **kw):
    base = dict(user_id=user_id, enabled=True, min_magnitude=4.0)
    base.update(kw)
    return EarthquakeNotificationPref(**base)


def _sub(user_id, endpoint):
    return PushSubscription(user_id=user_id, endpoint=endpoint, keys={"auth": "a", "p256dh": "b"})


async def test_dispatch_sends_to_matching_user_only():
    await _add(
        _real_pref(1, min_magnitude=4.0),
        _real_pref(2, min_magnitude=9.0),
        _sub(1, "https://push/1"),
        _sub(2, "https://push/2"),
    )

    calls = []

    async def fake_sender(sub, payload):
        calls.append(sub.user_id)
        return True

    async with AsyncSessionLocal() as db:
        summary = await eq_notify.dispatch_earthquake_notifications(
            db, [_eq(mag=5.0)], sender=fake_sender
        )

    assert calls == [1]
    assert summary["matches"] == 1
    assert summary["push_sent"] == 1
    assert summary["users_notified"] == 1


async def test_dispatch_dedup_skips_second_run():
    await _add(_real_pref(1), _sub(1, "https://push/1"))

    async def fake_sender(sub, payload):
        return True

    quakes = [_eq(mag=5.0)]
    async with AsyncSessionLocal() as db:
        first = await eq_notify.dispatch_earthquake_notifications(db, quakes, sender=fake_sender)
    async with AsyncSessionLocal() as db:
        second = await eq_notify.dispatch_earthquake_notifications(db, quakes, sender=fake_sender)

    assert first["push_sent"] == 1
    assert second["push_sent"] == 0
    assert second["skipped_already_sent"] == 1

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(EarthquakeNotificationSent))).scalars().all()
    assert len(rows) == 1


async def test_dispatch_matched_but_no_subscription_records_nothing():
    await _add(_real_pref(1))  # tercih var, abonelik yok

    async def fake_sender(sub, payload):
        raise AssertionError("abonelik yokken sender çağrılmamalı")

    async with AsyncSessionLocal() as db:
        summary = await eq_notify.dispatch_earthquake_notifications(
            db, [_eq(mag=5.0)], sender=fake_sender
        )

    assert summary["matched_no_subscription"] == 1
    assert summary["push_sent"] == 0

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(EarthquakeNotificationSent))).scalars().all()
    assert len(rows) == 0


# ── endpoint ──────────────────────────────────────────────────────────────────

def test_dispatch_endpoint_returns_summary(client, monkeypatch):
    # admin user (id=1) için tercih + abonelik
    client.put("/api/v1/earthquakes/preferences", json={"min_magnitude": 4.0})
    client.post(
        "/api/v1/push/subscribe",
        json={"endpoint": "https://push/endpoint-1", "keys": {"auth": "a", "p256dh": "b"}},
    )

    async def fake_fetch():
        return {"result": [_eq(mag=5.5)], "partial_errors": []}

    async def fake_send(sub, payload):
        return True

    monkeypatch.setattr("app.api.earthquakes._fetch_fresh", fake_fetch)
    monkeypatch.setattr("app.api.push._vapid_configured", lambda: True)
    monkeypatch.setattr("app.api.push._send_one", fake_send)

    res = client.post("/api/v1/earthquakes/dispatch-notifications")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["push_sent"] == 1
    assert data["users_notified"] == 1


def test_dispatch_endpoint_503_when_vapid_unconfigured(client, monkeypatch):
    monkeypatch.setattr("app.api.push._vapid_configured", lambda: False)
    res = client.post("/api/v1/earthquakes/dispatch-notifications")
    assert res.status_code == 503
