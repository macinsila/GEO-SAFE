"""
Turn-by-turn routing — GS-030.

GET /api/v1/routing/directions
  Proxies OpenRouteService walking directions.
  Falls back to a straight-line GeoJSON when ORS is unavailable or unconfigured.

Env:
  ORS_API_KEY  — OpenRouteService API key (free tier: 2 000 req/day).
                 If absent, always returns the straight-line fallback.
"""

import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.api.response import success_response

router = APIRouter(tags=["routing"])

ORS_BASE = "https://api.openrouteservice.org/v2/directions/foot-walking"
_ORS_TIMEOUT = 10


def _straight_line_geojson(
    from_lon: float, from_lat: float, to_lon: float, to_lat: float
) -> dict:
    """Minimal GeoJSON LineString between two points (fallback)."""
    import math

    dlat = math.radians(to_lat - from_lat)
    dlon = math.radians(to_lon - from_lon)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(from_lat)) * math.cos(
        math.radians(to_lat)
    ) * math.sin(dlon / 2) ** 2
    distance_m = 6371000 * 2 * math.asin(math.sqrt(a))

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[from_lon, from_lat], [to_lon, to_lat]],
                },
                "properties": {
                    "distance_m": round(distance_m),
                    "duration_s": round(distance_m / 1.4),  # ~5 km/h walking
                    "mode": "straight_line",
                    "steps": [],
                },
            }
        ],
    }


async def _fetch_ors_route(
    api_key: str,
    from_lon: float,
    from_lat: float,
    to_lon: float,
    to_lat: float,
) -> dict:
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json",
    }
    body = {
        "coordinates": [[from_lon, from_lat], [to_lon, to_lat]],
        "instructions": True,
        "language": "tr",
        "units": "m",
    }

    async with httpx.AsyncClient(timeout=_ORS_TIMEOUT) as client:
        resp = await client.post(ORS_BASE, json=body, headers=headers)
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

    # ORS returns encoded polyline — decode geometry
    geometry = route.get("geometry")
    coordinates: list = []
    if isinstance(geometry, dict):
        coordinates = geometry.get("coordinates", [])
    elif isinstance(geometry, str):
        coordinates = _decode_polyline(geometry)

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": {
                    "distance_m": round(summary.get("distance", 0)),
                    "duration_s": round(summary.get("duration", 0)),
                    "mode": "walking",
                    "steps": steps,
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


@router.get("/directions")
async def get_directions(
    from_lat: float = Query(..., ge=-90, le=90),
    from_lon: float = Query(..., ge=-180, le=180),
    to_lat: float = Query(..., ge=-90, le=90),
    to_lon: float = Query(..., ge=-180, le=180),
    mode: Optional[str] = Query(default="walking", description="Routing mode (walking)"),
):
    """
    Returns a GeoJSON FeatureCollection with the walking route.
    Uses OpenRouteService when ORS_API_KEY is set; falls back to straight-line otherwise.
    """
    api_key = os.getenv("ORS_API_KEY", "").strip()

    if not api_key:
        geojson = _straight_line_geojson(from_lon, from_lat, to_lon, to_lat)
        return success_response(
            data={**geojson, "fallback": True},
            message="Düz çizgi rota (ORS_API_KEY ayarlanmamış)",
        )

    try:
        geojson = await _fetch_ors_route(api_key, from_lon, from_lat, to_lon, to_lat)
        return success_response(data=geojson, message="Yürüyüş rotası hesaplandı")
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise HTTPException(
                status_code=429, detail="Routing API günlük kotası doldu, lütfen sonra tekrar deneyin"
            )
        # Any other ORS error → serve the straight-line fallback
        geojson = _straight_line_geojson(from_lon, from_lat, to_lon, to_lat)
        return success_response(
            data={**geojson, "fallback": True},
            message=f"ORS hatası ({exc.response.status_code}) — düz çizgi fallback",
        )
    except Exception as exc:
        geojson = _straight_line_geojson(from_lon, from_lat, to_lon, to_lat)
        return success_response(
            data={**geojson, "fallback": True},
            message=f"Routing hatası — düz çizgi fallback: {exc}",
        )
