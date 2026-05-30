"""
Tests for GS-042: emergency photo upload endpoint.
Storage calls are mocked so no real Supabase credentials are needed.
"""

import io
from unittest.mock import AsyncMock, patch

from app.api.rate_limit import emergency_limiter, public_form_dedup

_REPORT_PAYLOAD = {
    "durum": "Enkaz Altindayim",
    "saat": "2026-05-31 10:00",
    "harita_link": "https://maps.example.com",
    "enlem": 41.01,
    "boylam": 29.01,
}

FAKE_URL = "https://project.supabase.co/storage/v1/object/public/emergency-photos/fake.jpg"


def _reset():
    emergency_limiter._buckets.clear()
    public_form_dedup._seen.clear()


def _make_jpeg(size: int = 100) -> bytes:
    """Minimal valid-ish JPEG header + padding."""
    return b"\xff\xd8\xff\xe0" + b"\x00" * size


# ─────────────────────────────────────────────────────────────────────────────
# Happy path
# ─────────────────────────────────────────────────────────────────────────────

def test_upload_image_stores_url(client):
    _reset()
    report_id = client.post("/api/v1/emergency", json=_REPORT_PAYLOAD).json()["data"]["id"]

    with patch("app.api.emergency.upload_image", new=AsyncMock(return_value=FAKE_URL)):
        res = client.post(
            f"/api/v1/emergency/{report_id}/image",
            files={"file": ("photo.jpg", io.BytesIO(_make_jpeg()), "image/jpeg")},
        )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["image_url"] == FAKE_URL
    assert data["id"] == report_id


def test_upload_image_appears_in_admin_list(client):
    _reset()
    report_id = client.post("/api/v1/emergency", json=_REPORT_PAYLOAD).json()["data"]["id"]

    with patch("app.api.emergency.upload_image", new=AsyncMock(return_value=FAKE_URL)):
        client.post(
            f"/api/v1/emergency/{report_id}/image",
            files={"file": ("photo.jpg", io.BytesIO(_make_jpeg()), "image/jpeg")},
        )

    reports = client.get("/api/v1/emergency").json()["data"]
    match = next((r for r in reports if r["id"] == report_id), None)
    assert match is not None
    assert match["image_url"] == FAKE_URL


def test_upload_png_accepted(client):
    _reset()
    report_id = client.post("/api/v1/emergency", json=_REPORT_PAYLOAD).json()["data"]["id"]

    with patch("app.api.emergency.upload_image", new=AsyncMock(return_value=FAKE_URL)):
        res = client.post(
            f"/api/v1/emergency/{report_id}/image",
            files={"file": ("photo.png", io.BytesIO(b"\x89PNG\r\n" + b"\x00" * 50), "image/png")},
        )
    assert res.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# Validation failures
# ─────────────────────────────────────────────────────────────────────────────

def test_upload_wrong_content_type_rejected(client):
    _reset()
    report_id = client.post("/api/v1/emergency", json=_REPORT_PAYLOAD).json()["data"]["id"]

    res = client.post(
        f"/api/v1/emergency/{report_id}/image",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert res.status_code == 422


def test_upload_too_large_rejected(client):
    _reset()
    report_id = client.post("/api/v1/emergency", json=_REPORT_PAYLOAD).json()["data"]["id"]

    big_file = b"\xff\xd8\xff\xe0" + b"\x00" * (11 * 1024 * 1024)
    res = client.post(
        f"/api/v1/emergency/{report_id}/image",
        files={"file": ("big.jpg", io.BytesIO(big_file), "image/jpeg")},
    )
    assert res.status_code == 422


def test_upload_report_not_found(client):
    with patch("app.api.emergency.upload_image", new=AsyncMock(return_value=FAKE_URL)):
        res = client.post(
            "/api/v1/emergency/999999/image",
            files={"file": ("photo.jpg", io.BytesIO(_make_jpeg()), "image/jpeg")},
        )
    assert res.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Storage not configured
# ─────────────────────────────────────────────────────────────────────────────

def test_upload_storage_not_configured_returns_503(client):
    _reset()
    report_id = client.post("/api/v1/emergency", json=_REPORT_PAYLOAD).json()["data"]["id"]

    from app.api import storage as storage_mod
    with patch.object(storage_mod, "_SUPABASE_URL", ""), \
         patch.object(storage_mod, "_SERVICE_KEY", ""):
        res = client.post(
            f"/api/v1/emergency/{report_id}/image",
            files={"file": ("photo.jpg", io.BytesIO(_make_jpeg()), "image/jpeg")},
        )
    assert res.status_code == 503
