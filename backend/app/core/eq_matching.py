"""
Deprem ↔ kullanıcı tercihi eşleştirme — GS-100.

Saf (yan etkisiz) yüklem ve mesafe yardımcı fonksiyonu. GS-101 bildirim motoru
bu modülü import ederek eşleşen kullanıcıları bulur.
"""

import math
from typing import Any


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """İki coğrafi nokta arasındaki büyük-daire mesafesi (kilometre)."""
    earth_radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return earth_radius_km * 2 * math.asin(math.sqrt(a))


def _to_float(value: Any) -> float | None:
    """Upstream alanları str/float karışık gelebilir; güvenli float'a çevir."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def earthquake_matches_preference(eq: dict, pref: Any) -> bool:
    """
    Bir depremin (`eq`) kullanıcı tercihiyle (`pref`) eşleşip eşleşmediğini döndürür.

    eq: en az {"mag": ...} içeren feed kaydı; ops. "depth", "lat", "lon".
    pref: enabled, min_magnitude, max_depth_km, reference_lat/lon, radius_km
          alanlarına sahip nesne (model veya benzeri).

    Kurallar:
      - pref.enabled False → eşleşmez
      - eq.mag < min_magnitude → eşleşmez (mag okunamazsa eşleşmez)
      - max_depth_km set + eq.depth > max_depth_km → eşleşmez
        (depth okunamazsa derinlik filtresi atlanır; mag birincil sinyal)
      - radius_km set → referans koordinat veya eq koordinatı eksikse eşleşmez;
        haversine > radius_km → eşleşmez
    """
    if not pref.enabled:
        return False

    mag = _to_float(eq.get("mag"))
    if mag is None or mag < pref.min_magnitude:
        return False

    if pref.max_depth_km is not None:
        depth = _to_float(eq.get("depth"))
        if depth is not None and depth > pref.max_depth_km:
            return False

    if pref.radius_km is not None:
        eq_lat = _to_float(eq.get("lat"))
        eq_lon = _to_float(eq.get("lon"))
        if (
            pref.reference_lat is None
            or pref.reference_lon is None
            or eq_lat is None
            or eq_lon is None
        ):
            return False
        if haversine_km(pref.reference_lat, pref.reference_lon, eq_lat, eq_lon) > pref.radius_km:
            return False

    return True
