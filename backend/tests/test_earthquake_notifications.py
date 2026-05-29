"""GS-100 — deprem bildirim tercihleri: saf eşleştirme yüklemi + endpoint'ler."""

from types import SimpleNamespace

from app.api.earthquakes import _extract_coords
from app.core.eq_matching import earthquake_matches_preference, haversine_km

# Istanbul referans noktası
IST_LAT, IST_LON = 41.0, 29.0


def make_pref(**overrides):
    base = dict(
        enabled=True,
        min_magnitude=4.0,
        max_depth_km=None,
        reference_lat=None,
        reference_lon=None,
        radius_km=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


# ── haversine ────────────────────────────────────────────────────────────────

def test_haversine_zero_distance():
    assert haversine_km(IST_LAT, IST_LON, IST_LAT, IST_LON) == 0.0


def test_haversine_known_distance_ist_ankara():
    # İstanbul ↔ Ankara ~350-360 km
    dist = haversine_km(41.0082, 28.9784, 39.9334, 32.8597)
    assert 330 < dist < 380


# ── magnitude kuralı ──────────────────────────────────────────────────────────

def test_below_min_magnitude_does_not_match():
    pref = make_pref(min_magnitude=5.0)
    assert earthquake_matches_preference({"mag": 4.9}, pref) is False


def test_at_or_above_min_magnitude_matches():
    pref = make_pref(min_magnitude=5.0)
    assert earthquake_matches_preference({"mag": 5.0}, pref) is True
    assert earthquake_matches_preference({"mag": 6.2}, pref) is True


def test_missing_or_unparseable_magnitude_does_not_match():
    pref = make_pref(min_magnitude=4.0)
    assert earthquake_matches_preference({}, pref) is False
    assert earthquake_matches_preference({"mag": "n/a"}, pref) is False


def test_disabled_preference_never_matches():
    pref = make_pref(enabled=False, min_magnitude=1.0)
    assert earthquake_matches_preference({"mag": 9.0}, pref) is False


# ── derinlik kuralı ───────────────────────────────────────────────────────────

def test_depth_deeper_than_max_does_not_match():
    pref = make_pref(max_depth_km=20.0)
    assert earthquake_matches_preference({"mag": 5.0, "depth": 30.0}, pref) is False


def test_depth_within_max_matches():
    pref = make_pref(max_depth_km=20.0)
    assert earthquake_matches_preference({"mag": 5.0, "depth": 10.0}, pref) is True


def test_unparseable_depth_skips_depth_filter():
    pref = make_pref(max_depth_km=20.0)
    assert earthquake_matches_preference({"mag": 5.0, "depth": None}, pref) is True


# ── mesafe kuralı ─────────────────────────────────────────────────────────────

def test_within_radius_matches():
    pref = make_pref(reference_lat=IST_LAT, reference_lon=IST_LON, radius_km=50.0)
    eq = {"mag": 5.0, "lat": 41.05, "lon": 29.05}  # ~6-7 km uzakta
    assert earthquake_matches_preference(eq, pref) is True


def test_outside_radius_does_not_match():
    pref = make_pref(reference_lat=IST_LAT, reference_lon=IST_LON, radius_km=50.0)
    eq = {"mag": 5.0, "lat": 39.0, "lon": 35.0}  # çok uzak
    assert earthquake_matches_preference(eq, pref) is False


def test_radius_set_but_eq_missing_coords_does_not_match():
    pref = make_pref(reference_lat=IST_LAT, reference_lon=IST_LON, radius_km=50.0)
    assert earthquake_matches_preference({"mag": 5.0}, pref) is False


def test_radius_set_but_reference_missing_does_not_match():
    pref = make_pref(radius_km=50.0)  # referans koordinat yok
    eq = {"mag": 5.0, "lat": 41.01, "lon": 29.01}
    assert earthquake_matches_preference(eq, pref) is False


def test_no_radius_ignores_distance():
    pref = make_pref(min_magnitude=4.0)  # radius_km None
    eq = {"mag": 5.0, "lat": 0.0, "lon": 0.0}  # dünyanın öbür ucu
    assert earthquake_matches_preference(eq, pref) is True


# ── feed koordinat çıkarımı ───────────────────────────────────────────────────

def test_extract_coords_from_geojson():
    eq = {"geojson": {"type": "Point", "coordinates": [29.1, 41.2]}}
    assert _extract_coords(eq) == (41.2, 29.1)  # (lat, lon)


def test_extract_coords_from_lat_lng_fallback():
    eq = {"lat": 38.5, "lng": 27.4}
    assert _extract_coords(eq) == (38.5, 27.4)


def test_extract_coords_missing_returns_none():
    assert _extract_coords({"title": "x"}) == (None, None)


# ── endpoint'ler (client fixture: get_current_user → user id=1) ───────────────

def test_get_preferences_returns_defaults_when_none(client):
    res = client.get("/api/v1/earthquakes/preferences")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["id"] is None
    assert data["user_id"] == 1
    assert data["enabled"] is True
    assert data["min_magnitude"] == 4.0
    assert data["radius_km"] is None


def test_put_then_get_preferences_persists(client):
    body = {
        "enabled": True,
        "min_magnitude": 5.0,
        "max_depth_km": 20.0,
        "reference_lat": IST_LAT,
        "reference_lon": IST_LON,
        "radius_km": 50.0,
    }
    put_res = client.put("/api/v1/earthquakes/preferences", json=body)
    assert put_res.status_code == 200
    put_data = put_res.json()["data"]
    assert put_data["id"] is not None
    assert put_data["min_magnitude"] == 5.0
    assert put_data["radius_km"] == 50.0

    get_res = client.get("/api/v1/earthquakes/preferences")
    get_data = get_res.json()["data"]
    assert get_data["id"] == put_data["id"]
    assert get_data["reference_lat"] == IST_LAT


def test_put_preferences_is_idempotent_upsert(client):
    first = client.put(
        "/api/v1/earthquakes/preferences", json={"min_magnitude": 5.0}
    ).json()["data"]
    second = client.put(
        "/api/v1/earthquakes/preferences", json={"min_magnitude": 6.0}
    ).json()["data"]
    # Aynı satır güncellenir (yeni satır oluşturulmaz)
    assert first["id"] == second["id"]
    assert second["min_magnitude"] == 6.0


def test_put_radius_without_reference_is_rejected(client):
    res = client.put(
        "/api/v1/earthquakes/preferences", json={"radius_km": 50.0}
    )
    assert res.status_code == 422
