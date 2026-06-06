"""
Tests for GS-023: geofenced incident alerts.

Covers the pure matching predicate, subscription CRUD, dispatch (admin),
and best-effort auto-dispatch when an emergency report is created.
"""

from unittest.mock import AsyncMock, patch

from app.core.geofence import subscription_matches_incident

# ─────────────────────────────────────────────────────────────────────────────
# Pure matching predicate
# ─────────────────────────────────────────────────────────────────────────────

class _Sub:
    def __init__(self, enabled=True, lat=41.0, lon=29.0, radius=5.0):
        self.enabled = enabled
        self.center_lat = lat
        self.center_lon = lon
        self.radius_km = radius


def test_match_inside_radius():
    # ~1.5 km apart → inside a 5 km radius
    sub = _Sub(lat=41.0082, lon=28.9784, radius=5.0)
    assert subscription_matches_incident(sub, 41.0150, 28.9784) is True


def test_no_match_outside_radius():
    sub = _Sub(lat=41.0082, lon=28.9784, radius=2.0)
    # ~30 km away
    assert subscription_matches_incident(sub, 41.27, 28.97) is False


def test_no_match_when_disabled():
    sub = _Sub(enabled=False)
    assert subscription_matches_incident(sub, 41.0, 29.0) is False


def test_no_match_when_no_location():
    sub = _Sub(lat=None, lon=None)
    assert subscription_matches_incident(sub, 41.0, 29.0) is False


def test_no_match_when_zero_radius():
    sub = _Sub(radius=0.0)
    assert subscription_matches_incident(sub, 41.0, 29.0) is False


# ─────────────────────────────────────────────────────────────────────────────
# Subscription CRUD
# ─────────────────────────────────────────────────────────────────────────────

def test_get_default_subscription(client):
    res = client.get("/api/v1/geofence/subscription")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["enabled"] is False
    assert data["center_lat"] is None
    assert data["id"] is None


def test_upsert_subscription(client):
    res = client.put(
        "/api/v1/geofence/subscription",
        json={"enabled": True, "center_lat": 41.0, "center_lon": 29.0, "radius_km": 10},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["enabled"] is True
    assert data["center_lat"] == 41.0
    assert data["radius_km"] == 10

    # Round-trips on GET
    got = client.get("/api/v1/geofence/subscription").json()["data"]
    assert got["center_lon"] == 29.0


def test_upsert_is_idempotent_per_user(client):
    client.put(
        "/api/v1/geofence/subscription",
        json={"enabled": True, "center_lat": 41.0, "center_lon": 29.0, "radius_km": 5},
    )
    client.put(
        "/api/v1/geofence/subscription",
        json={"enabled": True, "center_lat": 40.0, "center_lon": 28.0, "radius_km": 8},
    )
    got = client.get("/api/v1/geofence/subscription").json()["data"]
    assert got["center_lat"] == 40.0
    assert got["radius_km"] == 8


def test_enabled_without_location_rejected(client):
    res = client.put(
        "/api/v1/geofence/subscription",
        json={"enabled": True, "radius_km": 5},
    )
    assert res.status_code == 422


def test_lat_without_lon_rejected(client):
    res = client.put(
        "/api/v1/geofence/subscription",
        json={"enabled": False, "center_lat": 41.0, "radius_km": 5},
    )
    assert res.status_code == 422


def test_disabled_subscription_allowed_without_location(client):
    res = client.put(
        "/api/v1/geofence/subscription",
        json={"enabled": False, "radius_km": 5},
    )
    assert res.status_code == 200
    assert res.json()["data"]["enabled"] is False


# ─────────────────────────────────────────────────────────────────────────────
# Dispatch
# ─────────────────────────────────────────────────────────────────────────────

def test_dispatch_requires_vapid(client):
    with patch("app.api.push._vapid_configured", return_value=False):
        res = client.post(
            "/api/v1/geofence/dispatch",
            json={"lat": 41.0, "lon": 29.0, "title": "Test", "body": "Body"},
        )
    assert res.status_code == 503


def test_dispatch_notifies_matching_subscriber(client):
    # User 1 (test admin) opts in near the incident and has a push subscription.
    client.put(
        "/api/v1/geofence/subscription",
        json={"enabled": True, "center_lat": 41.0082, "center_lon": 28.9784, "radius_km": 10},
    )
    client.post(
        "/api/v1/push/subscribe",
        json={"endpoint": "https://push.example/abc", "keys": {"auth": "a", "p256dh": "p"}},
    )

    sender = AsyncMock(return_value=True)
    with patch("app.api.push._vapid_configured", return_value=True), patch(
        "app.api.push._send_one", new=sender
    ):
        res = client.post(
            "/api/v1/geofence/dispatch",
            json={"lat": 41.0150, "lon": 28.9784, "title": "Yakında olay", "body": "Detay"},
        )
    assert res.status_code == 200
    summary = res.json()["data"]
    assert summary["matched_subscriptions"] == 1
    assert summary["users_notified"] == 1
    assert summary["push_sent"] == 1
    sender.assert_awaited()


def test_dispatch_skips_far_subscriber(client):
    client.put(
        "/api/v1/geofence/subscription",
        json={"enabled": True, "center_lat": 41.0, "center_lon": 29.0, "radius_km": 2},
    )
    client.post(
        "/api/v1/push/subscribe",
        json={"endpoint": "https://push.example/far", "keys": {"auth": "a", "p256dh": "p"}},
    )
    sender = AsyncMock(return_value=True)
    with patch("app.api.push._vapid_configured", return_value=True), patch(
        "app.api.push._send_one", new=sender
    ):
        res = client.post(
            "/api/v1/geofence/dispatch",
            json={"lat": 41.5, "lon": 29.5, "title": "Uzak olay", "body": "Detay"},
        )
    summary = res.json()["data"]
    assert summary["matched_subscriptions"] == 0
    sender.assert_not_awaited()


# ─────────────────────────────────────────────────────────────────────────────
# Auto-dispatch on emergency report creation
# ─────────────────────────────────────────────────────────────────────────────

def test_emergency_create_triggers_geofence_dispatch(client):
    dispatch_mock = AsyncMock(return_value={})
    with patch("app.api.push._vapid_configured", return_value=True), patch(
        "app.core.geofence.dispatch_geofenced_alert", new=dispatch_mock
    ):
        res = client.post(
            "/api/v1/emergency",
            json={
                "durum": "Yardım",
                "saat": "12:00",
                "harita_link": "https://maps.example/x",
                "enlem": 41.0082,
                "boylam": 28.9784,
                "kategori": "Yangın",
            },
        )
    assert res.status_code == 201
    dispatch_mock.assert_awaited_once()
    kwargs = dispatch_mock.call_args.kwargs
    assert kwargs["lat"] == 41.0082
    assert kwargs["lon"] == 28.9784


def test_emergency_create_skips_dispatch_without_vapid(client):
    dispatch_mock = AsyncMock(return_value={})
    with patch("app.api.push._vapid_configured", return_value=False), patch(
        "app.core.geofence.dispatch_geofenced_alert", new=dispatch_mock
    ):
        res = client.post(
            "/api/v1/emergency",
            json={
                "durum": "Yardım",
                "saat": "12:01",
                "harita_link": "https://maps.example/y",
                "enlem": 41.0,
                "boylam": 29.0,
            },
        )
    assert res.status_code == 201
    dispatch_mock.assert_not_awaited()
