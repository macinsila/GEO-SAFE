"""
Simple sliding-window IP-based rate limiter.
No external dependencies — uses asyncio locks and stdlib only.
"""

import asyncio
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

    async def check(self, request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        cutoff = now - self.window_seconds

        async with self._lock:
            bucket = self._buckets[ip]
            # drop timestamps outside the window
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Rate limit asildi: son {self.window_seconds:.0f} saniyede "
                        f"en fazla {self.max_requests} istek yapilabilir."
                    ),
                )
            bucket.append(now)


# 20 requests / 60 seconds per IP for the spatial nearest-depot endpoint
nearest_depot_limiter = RateLimiter(max_requests=20, window_seconds=60)

# Emergency POST limiter: keep anonymous traffic under control
emergency_limiter = RateLimiter(max_requests=5, window_seconds=60)
