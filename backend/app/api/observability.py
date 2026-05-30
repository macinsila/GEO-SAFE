"""
GS-007: lightweight in-process metrics collector and middleware.
No external dependencies — exposes Prometheus text format manually.
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

    def record(self, method: str, path: str, status: int, duration: float) -> None:
        self._requests[(method, path, str(status))] += 1
        self._duration_sum[(method, path)] += duration
        self._duration_count[(method, path)] += 1

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

        return "\n".join(lines) + "\n"


collector = MetricsCollector()


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = _normalize(request.url.path)
        start = time.perf_counter()
        response = await call_next(request)
        collector.record(request.method, path, response.status_code, time.perf_counter() - start)
        return response
