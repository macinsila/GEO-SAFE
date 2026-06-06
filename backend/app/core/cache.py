"""
GS-064: Redis async caching layer with graceful bypass.

If REDIS_URL is not set or Redis is unreachable, all operations are no-ops:
  get() → None   set()/delete() → silently ignored
The application runs correctly without Redis; caching benefits are simply absent.
"""
import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as _aioredis
    _PACKAGE_PRESENT = True
except ImportError:
    _PACKAGE_PRESENT = False

_client: Optional[Any] = None
_connected: bool = False


async def connect() -> None:
    """Call on app startup.  Connects to Redis if REDIS_URL env var is set."""
    global _client, _connected
    if not _PACKAGE_PRESENT:
        logger.info("redis package not installed — caching disabled")
        return
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        logger.info("REDIS_URL not set — caching disabled (graceful bypass)")
        return
    try:
        _client = _aioredis.from_url(url, encoding="utf-8", decode_responses=True)
        await _client.ping()
        _connected = True
        safe_url = url.split("@")[-1] if "@" in url else url
        logger.info("Redis connected: %s", safe_url)
    except Exception as exc:
        logger.warning("Redis connection failed — caching disabled: %s", exc)
        _client = None
        _connected = False


async def disconnect() -> None:
    """Call on app shutdown."""
    global _client, _connected
    if _client is not None:
        try:
            await _client.aclose()
        except Exception:
            pass
        _client = None
    _connected = False


def is_available() -> bool:
    return _connected


async def get(key: str) -> Optional[Any]:
    """Return deserialized value, or None on miss / error / bypass."""
    if not _connected or _client is None:
        return None
    try:
        raw = await _client.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        logger.warning("Redis GET error key=%s: %s", key, exc)
        return None


async def set(key: str, value: Any, ttl: int = 300) -> None:
    """Serialize to JSON and store with TTL seconds.  No-op on error."""
    if not _connected or _client is None:
        return
    try:
        await _client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning("Redis SET error key=%s: %s", key, exc)


async def delete(*keys: str) -> None:
    """Delete one or more keys.  No-op on error / bypass."""
    if not _connected or _client is None or not keys:
        return
    try:
        await _client.delete(*keys)
    except Exception as exc:
        logger.warning("Redis DELETE error keys=%s: %s", keys, exc)
