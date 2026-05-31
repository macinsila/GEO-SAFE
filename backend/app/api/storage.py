"""
GS-042: Supabase Storage client for emergency photo uploads.
Gracefully disabled when SUPABASE_URL / SUPABASE_SERVICE_KEY are not set.
"""

import os
import uuid

import httpx
from fastapi import HTTPException

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

_SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
_BUCKET = os.getenv("STORAGE_BUCKET", "emergency-photos")


def storage_configured() -> bool:
    return bool(_SUPABASE_URL and _SERVICE_KEY)


async def upload_image(file_bytes: bytes, content_type: str) -> str:
    """Upload raw bytes to Supabase Storage and return the public URL."""
    if not storage_configured():
        raise HTTPException(
            status_code=503,
            detail="Image storage is not configured on this server. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
        )

    path = f"{uuid.uuid4()}.{_EXT.get(content_type, 'jpg')}"
    put_url = f"{_SUPABASE_URL}/storage/v1/object/{_BUCKET}/{path}"

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.put(
            put_url,
            content=file_bytes,
            headers={
                "Authorization": f"Bearer {_SERVICE_KEY}",
                "Content-Type": content_type,
            },
        )

    if res.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Storage upload failed (HTTP {res.status_code}).",
        )

    return f"{_SUPABASE_URL}/storage/v1/object/public/{_BUCKET}/{path}"
