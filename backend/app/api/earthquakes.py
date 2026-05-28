import asyncio
import time
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter

from app.api.response import success_response

router = APIRouter(tags=["earthquakes"])

# ── In-memory TTL cache ───────────────────────────────────────────────────────
_CACHE_TTL_SECONDS = 300  # 5 minutes — refreshes without hammering upstream
_cache_lock = asyncio.Lock()
_cached_payload: dict | None = None
_cache_expires_at: float = 0.0

KANDILLI_BASE = "https://api.orhanaydogdu.com.tr/deprem/kandilli/archive"
MAGNITUDE_THRESHOLD = 3.5
LOOKBACK_DAYS = 3


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
                filtered.append({
                    "mag": mag,
                    "title": eq["title"],
                    "date": eq["date_time"],
                    "depth": eq["depth"],
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
