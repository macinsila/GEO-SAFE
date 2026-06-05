"""
QR identity endpoints — GS-016 (KVKK) + GS-043 (offline signed payload).

GET /api/v1/qr/identity  — returns signed QR payload for the current user.
GET /api/v1/qr/verify    — verifies the HMAC signature of a QR payload (online check).

Signing: HMAC-SHA256 over the canonical payload fields (alphabetical key order,
no "sig" field included in the signed data). Key: QR_SIGNING_KEY env var,
fallback to JWT_SECRET. Both are server-side secrets; the QR is tamper-evident
but does not require a round-trip to display (the data is embedded in the URL).
"""

import hashlib
import hmac
import json
import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.response import success_response
from app.db import get_db
from app.models.user import User

router = APIRouter(tags=["qr"])

_SIGNED_FIELDS = ("allergies", "blood", "conditions", "disability", "issued", "medications", "name", "v")


def _signing_key() -> bytes:
    key = os.getenv("QR_SIGNING_KEY") or os.getenv("JWT_SECRET", "")
    if not key:
        raise RuntimeError("QR_SIGNING_KEY or JWT_SECRET must be set to sign QR payloads")
    return key.encode()


def _sign(payload: dict) -> str:
    """Return HMAC-SHA256 hex digest over canonical (sorted-key) payload data."""
    canonical = {k: payload.get(k, "") for k in _SIGNED_FIELDS}
    message = json.dumps(canonical, sort_keys=True, ensure_ascii=False).encode()
    return hmac.new(_signing_key(), message, hashlib.sha256).hexdigest()


def _verify_payload(payload: dict) -> bool:
    sig = payload.get("sig", "")
    expected = _sign(payload)
    return hmac.compare_digest(sig, expected)


def _decode_qr_param(d: str) -> dict | None:
    """Decode the base64-encoded QR payload from the URL parameter."""
    import base64

    try:
        raw = base64.b64decode(d.encode()).decode("utf-8")
        return json.loads(raw)
    except Exception:
        return None


def _mask_name(full_name: str) -> str:
    parts = full_name.strip().split()
    if not parts:
        return "Kullanici"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


@router.get("/identity")
async def get_qr_identity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    data = (user.data or {}) if user else {}
    name = data.get("name", "") or current_user.name or ""

    payload: dict = {
        "v": 1,
        "name": _mask_name(name),
        "blood": (data.get("blood", "") or "")[:50],
        "allergies": (data.get("allergy", "") or "")[:200],
        "medications": (data.get("meds", "") or "")[:200],
        "conditions": (data.get("chronic", "") or "")[:200],
        "disability": (data.get("disability_notes", "") or "")[:200],
        "issued": str(date.today()),
    }

    try:
        payload["sig"] = _sign(payload)
    except RuntimeError:
        pass  # signing key not configured — omit sig field rather than crash

    return success_response(
        data={
            "qr_payload": payload,
            "display_name": _mask_name(name),
            "issued_at": str(date.today()),
        },
        message="QR kimlik verisi hazir",
    )


@router.get("/verify")
async def verify_qr(d: str = Query(..., description="Base64-encoded QR payload")):
    """
    Online signature verification for a QR payload.
    Returns 200 if valid, 400 if signature mismatch, 422 if unparseable.
    The QR scan page calls this when online; when offline it shows data without the badge.
    """
    payload = _decode_qr_param(d)
    if payload is None:
        raise HTTPException(status_code=422, detail="QR verisi çözümlenemedi")

    if "sig" not in payload:
        raise HTTPException(status_code=400, detail="QR imzası yok — eski veya harici QR")

    try:
        valid = _verify_payload(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if not valid:
        raise HTTPException(status_code=400, detail="QR imzası geçersiz — veri değiştirilmiş olabilir")

    return success_response(data={"verified": True}, message="QR imzası doğrulandı")
