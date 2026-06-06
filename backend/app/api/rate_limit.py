"""
Sliding-window IP rate limiter and duplicate-submission filter.
No external dependencies — uses asyncio locks and stdlib only.
"""

import asyncio
import hashlib
import json
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    """
    Sliding window rate limiter: allows `max_requests` per `window_seconds` per IP.
    Thread-safe via asyncio.Lock.
    """

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, deque] = defaultdict(deque)
        self._lock = asyncio.Lock()
        self.blocked_count: int = 0

    async def check(self, request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        cutoff = now - self.window_seconds

        async with self._lock:
            bucket = self._buckets[ip]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                self.blocked_count += 1
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Rate limit asildi: son {self.window_seconds:.0f} saniyede "
                        f"en fazla {self.max_requests} istek yapilabilir."
                    ),
                )
            bucket.append(now)


class DuplicateFilter:
    """
    Rejects identical submissions from the same IP within a time window.
    Uses a SHA-256 content hash keyed by IP to detect resubmissions.
    """

    def __init__(self, window_seconds: float = 60.0) -> None:
        self.window_seconds = window_seconds
        self._seen: dict[str, dict[str, float]] = defaultdict(dict)
        self._lock = asyncio.Lock()
        self.rejected_count: int = 0

    @staticmethod
    def _hash(data: dict) -> str:
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode()).hexdigest()

    async def check(self, request: Request, data: dict) -> None:
        ip = request.client.host if request.client else "unknown"
        content_hash = self._hash(data)
        now = time.monotonic()
        cutoff = now - self.window_seconds

        async with self._lock:
            self._seen[ip] = {h: ts for h, ts in self._seen[ip].items() if ts >= cutoff}

            if content_hash in self._seen[ip]:
                self.rejected_count += 1
                raise HTTPException(
                    status_code=409,
                    detail="Duplicate submission: identical request already received recently.",
                )

            self._seen[ip][content_hash] = now


# 20 requests / 60 seconds per IP for the spatial nearest-depot endpoint
nearest_depot_limiter = RateLimiter(max_requests=20, window_seconds=60)

# Public form limiters — 5 requests / 60 seconds per IP
emergency_limiter = RateLimiter(max_requests=5, window_seconds=60)
volunteer_limiter = RateLimiter(max_requests=5, window_seconds=60)
shelter_limiter = RateLimiter(max_requests=5, window_seconds=60)

# Shared duplicate-submission filter for all public intake forms
public_form_dedup = DuplicateFilter(window_seconds=60)
