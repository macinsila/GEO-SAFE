"""
GS-007: lightweight in-process metrics collector and middleware.
No external dependencies — exposes Prometheus text format manually.

GS-064: added cache hit/miss/invalidation counters.
"""

import re
import time
from collections import defaultdict
from typing import Callable

from fastapi import Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

_ID_SEG = re.compile(r"/\d+(?=/|$)")


def _normalize(path: str) -> str:
    """Replace all-digit path segments with {id} to avoid high cardinality."""
    return _ID_SEG.sub("/{id}", path)


class MetricsCollector:
    def __init__(self) -> None:
        # (method, path, status_code_str) -> count
        self._requests: dict[tuple, int] = defaultdict(int)
        # (method, path) -> total seconds
        self._duration_sum: dict[tuple, float] = defaultdict(float)
        self._duration_count: dict[tuple, int] = defaultdict(int)
        # GS-064: cache counters keyed by resource name
        self._cache_hits: dict[str, int] = defaultdict(int)
        self._cache_misses: dict[str, int] = defaultdict(int)
        self._cache_invalidations: dict[str, int] = defaultdict(int)

    def record(self, method: str, path: str, status: int, duration: float) -> None:
        self._requests[(method, path, str(status))] += 1
        self._duration_sum[(method, path)] += duration
        self._duration_count[(method, path)] += 1

    def record_cache_hit(self, resource: str) -> None:
        self._cache_hits[resource] += 1

    def record_cache_miss(self, resource: str) -> None:
        self._cache_misses[resource] += 1

    def record_cache_invalidation(self, resource: str) -> None:
        self._cache_invalidations[resource] += 1

    def prometheus_text(self) -> str:
        lines: list[str] = []

        lines += [
            "# HELP http_requests_total Total HTTP requests by method, path, and status",
            "# TYPE http_requests_total counter",
        ]
        for (method, path, status), count in sorted(self._requests.items()):
            lines.append(
                f'http_requests_total{{method="{method}",path="{path}",status="{status}"}} {count}'
            )

        lines += [
            "# HELP http_request_duration_seconds_sum Sum of request durations in seconds",
            "# TYPE http_request_duration_seconds_sum counter",
        ]
        for (method, path), total in sorted(self._duration_sum.items()):
            lines.append(
                f'http_request_duration_seconds_sum{{method="{method}",path="{path}"}} {total:.6f}'
            )

        lines += [
            "# HELP http_request_duration_seconds_count Number of timed requests",
            "# TYPE http_request_duration_seconds_count counter",
        ]
        for (method, path), count in sorted(self._duration_count.items()):
            lines.append(
                f'http_request_duration_seconds_count{{method="{method}",path="{path}"}} {count}'
            )

        # GS-064: cache metrics (only emitted after first cache activity)
        if self._cache_hits or self._cache_misses or self._cache_invalidations:
            lines += [
                "# HELP cache_hits_total Cache hits by resource",
                "# TYPE cache_hits_total counter",
            ]
            for resource, count in sorted(self._cache_hits.items()):
                lines.append(f'cache_hits_total{{resource="{resource}"}} {count}')

            lines += [
                "# HELP cache_misses_total Cache misses by resource",
                "# TYPE cache_misses_total counter",
            ]
            for resource, count in sorted(self._cache_misses.items()):
                lines.append(f'cache_misses_total{{resource="{resource}"}} {count}')

            lines += [
                "# HELP cache_invalidations_total Cache invalidations by resource",
                "# TYPE cache_invalidations_total counter",
            ]
            for resource, count in sorted(self._cache_invalidations.items()):
                lines.append(f'cache_invalidations_total{{resource="{resource}"}} {count}')

        return "\n".join(lines) + "\n"


collector = MetricsCollector()


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = _normalize(request.url.path)
        start = time.perf_counter()
        response = await call_next(request)
        collector.record(request.method, path, response.status_code, time.perf_counter() - start)
        return response
