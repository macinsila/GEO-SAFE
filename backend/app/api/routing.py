"""
Turn-by-turn routing — GS-030 (base) + GS-032 (accessibility + waypoints).

GET /api/v1/routing/directions
  Proxies OpenRouteService walking or wheelchair directions.
  Falls back to a straight-line GeoJSON chain when ORS is unavailable.

Query params:
  from_lat, from_lon, to_lat, to_lon   required — start / end coordinates
  accessibility  bool  (default false) — use ORS wheelchair (stair-free) profile
  waypoints      str   (default null)  — intermediate stops: "lat,lon;lat,lon"
  mode           str   (default walking, informational only)

Env:
  ORS_API_KEY  — OpenRouteService API key (free tier: 2 000 req/day).
                 If absent, always returns the straight-line fallback.
"""

import math
import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.api.response import success_response

router = APIRouter(tags=["routing"])

ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/{profile}"
_ORS_TIMEOUT = 10


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance in metres between two WGS-84 points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 6_371_000 * 2 * math.asin(math.sqrt(a))


def _straight_line_geojson_multi(coordinates: list[list[float]]) -> dict:
    """
    Chain straight-line segments for any number of waypoints.
    coordinates: [[lon, lat], ...] in GeoJSON order.
    """
    all_coords: list[list[float]] = []
    total_distance = 0.0

    for i in range(len(coordinates) - 1):
        a = coordinates[i]
        b = coordinates[i + 1]
        seg_dist = _haversine_m(a[0], a[1], b[0], b[1])
        total_distance += seg_dist
        if i == 0:
            all_coords.append(a)
        all_coords.append(b)

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": all_coords},
                "properties": {
                    "distance_m": round(total_distance),
                    "duration_s": round(total_distance / 1.4),  # ~5 km/h
                    "mode": "straight_line",
                    "accessibility": False,
                    "waypoint_count": max(0, len(coordinates) - 2),
                    "steps": [],
                },
            }
        ],
    }


def _decode_polyline(encoded: str) -> list[list[float]]:
    """Decode a Google/ORS encoded polyline string to [[lon, lat], ...]."""
    coords: list[list[float]] = []
    index, lat, lng = 0, 0, 0
    while index < len(encoded):
        for is_lng in (False, True):
            shift, result = 0, 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lng:
                lng += delta
                coords.append([lng / 1e5, lat / 1e5])
            else:
                lat += delta
    return coords


# ── ORS fetch ─────────────────────────────────────────────────────────────────

async def _fetch_ors_route(
    api_key: str,
    coordinates: list[list[float]],
    profile: str,
) -> dict:
    """
    Call ORS Directions API.

    coordinates: [[lon, lat], ...] — 2 or more points (start, optional waypoints, end)
    profile:     "foot-walking" | "wheelchair"
    """
    headers = {"Authorization": api_key, "Content-Type": "application/json"}
    body = {
        "coordinates": coordinates,
        "instructions": True,
        "language": "tr",
        "units": "m",
    }
    url = ORS_DIRECTIONS_URL.format(profile=profile)

    async with httpx.AsyncClient(timeout=_ORS_TIMEOUT) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    route = data["routes"][0]
    summary = route["summary"]
    segments = route.get("segments", [])

    steps = []
    for segment in segments:
        for step in segment.get("steps", []):
            steps.append(
                {
                    "instruction": step.get("instruction", ""),
                    "distance_m": round(step.get("distance", 0)),
                    "duration_s": round(step.get("duration", 0)),
                    "type": step.get("type"),
                }
            )

    geometry = route.get("geometry")
    route_coords: list = []
    if isinstance(geometry, dict):
        route_coords = geometry.get("coordinates", [])
    elif isinstance(geometry, str):
        route_coords = _decode_polyline(geometry)

    is_accessible = profile == "wheelchair"
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": route_coords},
                "properties": {
                    "distance_m": round(summary.get("distance", 0)),
                    "duration_s": round(summary.get("duration", 0)),
                    "mode": "wheelchair" if is_accessible else "walking",
                    "accessibility": is_accessible,
                    "waypoint_count": max(0, len(coordinates) - 2),
                    "steps": steps,
                },
            }
        ],
    }


# ── Waypoint parser ───────────────────────────────────────────────────────────

def _parse_waypoints(raw: str) -> list[list[float]]:
    """
    Parse "lat,lon;lat,lon" → [[lon, lat], ...] (GeoJSON [lon, lat] order).
    Raises HTTPException 422 on invalid input.
    """
    result: list[list[float]] = []
    for part in raw.split(";"):
        part = part.strip()
        if not part:
            continue
        try:
            lat_s, lon_s = part.split(",", 1)
            lat = float(lat_s.strip())
            lon = float(lon_s.strip())
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Geçersiz waypoint formatı: '{part}' — beklenen: 'lat,lon'",
            )
        if not (-90 <= lat <= 90):
            raise HTTPException(status_code=422, detail=f"Enlem aralık dışı: {lat}")
        if not (-180 <= lon <= 180):
            raise HTTPException(status_code=422, detail=f"Boylam aralık dışı: {lon}")
        result.append([lon, lat])
    return result


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/directions")
async def get_directions(
    from_lat: float = Query(..., ge=-90, le=90),
    from_lon: float = Query(..., ge=-180, le=180),
    to_lat: float = Query(..., ge=-90, le=90),
    to_lon: float = Query(..., ge=-180, le=180),
    accessibility: bool = Query(
        default=False,
        description="Erişilebilir rota (merdivensiz) — ORS wheelchair profili kullanır",
    ),
    waypoints: Optional[str] = Query(
        default=None,
        description="Ara duraklar: 'lat,lon;lat,lon' formatında, noktalı virgülle ayrılmış",
    ),
    mode: Optional[str] = Query(default="walking", description="Routing mode (informational)"),
):
    """
    Returns a GeoJSON FeatureCollection with the route.

    - ``accessibility=true`` → ORS wheelchair profile (merdivensiz yol).
    - ``waypoints`` → sıralı ara duraklar; rota bunlar üzerinden hesaplanır.
    - Falls back to a chained straight-line geometry when ORS is unavailable.
    """
    profile = "wheelchair" if accessibility else "foot-walking"

    # Build coordinate chain: origin → waypoints → destination
    coordinates: list[list[float]] = [[from_lon, from_lat]]
    if waypoints:
        coordinates.extend(_parse_waypoints(waypoints))
    coordinates.append([to_lon, to_lat])

    api_key = os.getenv("ORS_API_KEY", "").strip()

    if not api_key:
        geojson = _straight_line_geojson_multi(coordinates)
        return success_response(
            data={**geojson, "fallback": True},
            message="Düz çizgi rota (ORS_API_KEY ayarlanmamış)",
        )

    try:
        geojson = await _fetch_ors_route(api_key, coordinates, profile)
        msg = (
            "Erişilebilir rota hesaplandı (merdivensiz)"
            if accessibility
            else "Yürüyüş rotası hesaplandı"
        )
        return success_response(data=geojson, message=msg)

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Routing API günlük kotası doldu, lütfen sonra tekrar deneyin",
            )
        geojson = _straight_line_geojson_multi(coordinates)
        return success_response(
            data={**geojson, "fallback": True},
            message=f"ORS hatası ({exc.response.status_code}) — düz çizgi fallback",
        )

    except Exception as exc:
        geojson = _straight_line_geojson_multi(coordinates)
        return success_response(
            data={**geojson, "fallback": True},
            message=f"Routing hatası — düz çizgi fallback: {exc}",
        )
