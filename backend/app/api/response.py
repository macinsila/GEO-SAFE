"""
Shared API response helpers.
All responses should include: status, data, message.
"""

from typing import Any


def success_response(data: Any = None, message: str = "OK") -> dict[str, Any]:
    return {
        "status": "success",
        "data": data,
        "message": message,
    }


def error_response(message: str, data: Any = None) -> dict[str, Any]:
    return {
        "status": "error",
        "data": data,
        "message": message,
    }
