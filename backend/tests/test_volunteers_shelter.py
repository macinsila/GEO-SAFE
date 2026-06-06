"""
Tests for volunteer intake and shelter offer endpoints.
Covers Sprint 2 (create + admin list security) and Sprint 3A (status filter + status update).
"""

from app.api.auth import get_current_user
from app.main import app
from app.models.user import User

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _override_viewer():
    async def _inner():
        return User(id=2, name="Viewer", email="viewer@test.local", role="viewer")
    return _inner


def _with_viewer(client, call_fn):
    """Temporarily override get_current_user with a viewer, run call_fn, restore."""
    original = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = _override_viewer()
    try:
        return call_fn()
    finally:
        if original is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 2 — Volunteer
# ─────────────────────────────────────────────────────────────────────────────

def test_volunteer_public_create_sanitized_and_pending(client):
    payload = {
        "full_name": "Test Volunteer",
        "contact_info": "555-0100",
        "district": "Kadikoy",
        "neighborhood": "Moda",
        "skills": ["Ilk yardim", "Teknik destek"],
        "availability_note": "Hafta sonu",
    }

    response = client.post("/api/v1/volunteers", json=payload)
    assert response.status_code == 201

    body = response.json()
    assert body["status"] == "success"
    assert body["data"]["status"] == "pending"
    assert "full_name" not in body["data"]
    assert "contact_info" not in body["data"]


def test_volunteer_admin_list_requires_admin_role(client):
    response = _with_viewer(client, lambda: client.get("/api/v1/volunteers/admin"))
    assert response.status_code == 403


def test_volunteer_admin_list_includes_details(client):
    payload = {
        "full_name": "Admin Volunteer",
        "contact_info": "555-0200",
        "district": "Besiktas",
        "neighborhood": "Levent",
        "skills": ["Arac destegi"],
        "availability_note": "Aksam",
    }

    create_res = client.post("/api/v1/volunteers", json=payload)
    assert create_res.status_code == 201

    list_res = client.get("/api/v1/volunteers/admin")
    assert list_res.status_code == 200

    body = list_res.json()
    assert body["status"] == "success"
    assert body["data"]
    first = body["data"][0]
    assert first["status"] == "pending"
    assert first["full_name"] == "Admin Volunteer"
    assert first["contact_info"] == "555-0200"


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 3A — Volunteer status filter
# ─────────────────────────────────────────────────────────────────────────────

def test_volunteer_status_filter_works(client):
    """Admin can filter volunteer list by status."""
    base = {
        "full_name": "Filter Vol",
        "contact_info": "555-0300",
        "skills": [],
    }
    # Create two volunteers (both start pending)
    r1 = client.post("/api/v1/volunteers", json={**base, "full_name": "Vol A"})
    r2 = client.post("/api/v1/volunteers", json={**base, "full_name": "Vol B"})
    assert r1.status_code == 201
    assert r2.status_code == 201
    vol_a_id = r1.json()["data"]["id"]

    # Approve vol_a via admin PATCH
    patch_res = client.patch(f"/api/v1/volunteers/admin/{vol_a_id}/status", json={"status": "approved"})
    assert patch_res.status_code == 200

    # Filter pending → should not contain vol_a
    pending_res = client.get("/api/v1/volunteers/admin?status=pending")
    assert pending_res.status_code == 200
    pending_ids = [v["id"] for v in pending_res.json()["data"]]
    assert vol_a_id not in pending_ids

    # Filter approved → should contain only vol_a
    approved_res = client.get("/api/v1/volunteers/admin?status=approved")
    assert approved_res.status_code == 200
    approved_ids = [v["id"] for v in approved_res.json()["data"]]
    assert vol_a_id in approved_ids


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 3A — Volunteer status update
# ─────────────────────────────────────────────────────────────────────────────

def test_volunteer_admin_status_update_works(client):
    """Admin can update volunteer status to any allowed value."""
    create_res = client.post("/api/v1/volunteers", json={
        "full_name": "Status Vol",
        "contact_info": "555-0400",
        "skills": [],
    })
    assert create_res.status_code == 201
    vol_id = create_res.json()["data"]["id"]

    for new_status in ("approved", "rejected", "inactive", "pending"):
        patch_res = client.patch(
            f"/api/v1/volunteers/admin/{vol_id}/status",
            json={"status": new_status},
        )
        assert patch_res.status_code == 200, f"Expected 200 for status={new_status}"
        assert patch_res.json()["data"]["status"] == new_status


def test_volunteer_admin_status_update_forbidden_for_non_admin(client):
    """Non-admin (viewer) cannot update volunteer status."""
    create_res = client.post("/api/v1/volunteers", json={
        "full_name": "Forbidden Vol",
        "contact_info": "555-0500",
        "skills": [],
    })
    assert create_res.status_code == 201
    vol_id = create_res.json()["data"]["id"]

    response = _with_viewer(
        client,
        lambda: client.patch(
            f"/api/v1/volunteers/admin/{vol_id}/status",
            json={"status": "approved"},
        ),
    )
    assert response.status_code == 403


def test_volunteer_admin_status_update_invalid_status_rejected(client):
    """Invalid status value returns 422."""
    create_res = client.post("/api/v1/volunteers", json={
        "full_name": "Bad Status Vol",
        "contact_info": "555-0600",
        "skills": [],
    })
    assert create_res.status_code == 201
    vol_id = create_res.json()["data"]["id"]

    patch_res = client.patch(
        f"/api/v1/volunteers/admin/{vol_id}/status",
        json={"status": "superadmin"},
    )
    assert patch_res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 2 — Shelter offer
# ─────────────────────────────────────────────────────────────────────────────

def test_shelter_public_create_sanitized_and_pending(client):
    payload = {
        "host_name": "Test Host",
        "contact_info": "555-0300",
        "city": "Istanbul",
        "district": "Sisli",
        "neighborhood": "Mecidiyekoy",
        "address_detail": "Acik adres bilgisi",
        "capacity": 3,
        "duration_note": "2 hafta",
        "household_notes": "2 kedi",
        "suitability_notes": "Merdiven yok",
    }

    response = client.post("/api/v1/shelter-offers", json=payload)
    assert response.status_code == 201

    body = response.json()
    assert body["status"] == "success"
    assert body["data"]["status"] == "pending"
    assert "address_detail" not in body["data"]
    assert "contact_info" not in body["data"]


def test_shelter_admin_list_requires_admin_role(client):
    response = _with_viewer(client, lambda: client.get("/api/v1/shelter-offers/admin"))
    assert response.status_code == 403


def test_shelter_public_listing_not_available(client):
    response = client.get("/api/v1/shelter-offers/public")
    assert response.status_code == 404


def test_shelter_admin_list_includes_details(client):
    payload = {
        "host_name": "Admin Host",
        "contact_info": "555-0700",
        "city": "Ankara",
        "district": "Cankaya",
        "neighborhood": "Kizilay",
        "address_detail": "Kat 3 Daire 7",
        "capacity": 5,
    }
    create_res = client.post("/api/v1/shelter-offers", json=payload)
    assert create_res.status_code == 201

    list_res = client.get("/api/v1/shelter-offers/admin")
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["data"]
    first = body["data"][0]
    assert first["address_detail"] == "Kat 3 Daire 7"
    assert first["contact_info"] == "555-0700"


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 3A — Shelter status filter
# ─────────────────────────────────────────────────────────────────────────────

def test_shelter_status_filter_works(client):
    """Admin can filter shelter offer list by status."""
    base = {"host_name": "Filter Host", "contact_info": "555-0800", "capacity": 2}
    r1 = client.post("/api/v1/shelter-offers", json={**base, "host_name": "Host A"})
    r2 = client.post("/api/v1/shelter-offers", json={**base, "host_name": "Host B"})
    assert r1.status_code == 201
    assert r2.status_code == 201
    offer_a_id = r1.json()["data"]["id"]

    # Approve offer_a
    patch_res = client.patch(
        f"/api/v1/shelter-offers/admin/{offer_a_id}/status",
        json={"status": "approved"},
    )
    assert patch_res.status_code == 200

    pending_res = client.get("/api/v1/shelter-offers/admin?status=pending")
    pending_ids = [o["id"] for o in pending_res.json()["data"]]
    assert offer_a_id not in pending_ids

    approved_res = client.get("/api/v1/shelter-offers/admin?status=approved")
    approved_ids = [o["id"] for o in approved_res.json()["data"]]
    assert offer_a_id in approved_ids


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 3A — Shelter status update
# ─────────────────────────────────────────────────────────────────────────────

def test_shelter_admin_status_update_works(client):
    """Admin can update shelter status to any allowed value."""
    create_res = client.post("/api/v1/shelter-offers", json={
        "host_name": "Status Host",
        "contact_info": "555-0900",
        "capacity": 4,
    })
    assert create_res.status_code == 201
    offer_id = create_res.json()["data"]["id"]

    for new_status in ("approved", "rejected", "inactive", "pending"):
        patch_res = client.patch(
            f"/api/v1/shelter-offers/admin/{offer_id}/status",
            json={"status": new_status},
        )
        assert patch_res.status_code == 200, f"Expected 200 for status={new_status}"
        assert patch_res.json()["data"]["status"] == new_status


def test_shelter_admin_status_update_forbidden_for_non_admin(client):
    """Non-admin cannot update shelter status."""
    create_res = client.post("/api/v1/shelter-offers", json={
        "host_name": "Forbidden Host",
        "contact_info": "555-1000",
        "capacity": 2,
    })
    assert create_res.status_code == 201
    offer_id = create_res.json()["data"]["id"]

    response = _with_viewer(
        client,
        lambda: client.patch(
            f"/api/v1/shelter-offers/admin/{offer_id}/status",
            json={"status": "approved"},
        ),
    )
    assert response.status_code == 403


def test_shelter_public_response_hides_address_and_contact(client):
    """Public create response never exposes address_detail or contact_info."""
    create_res = client.post("/api/v1/shelter-offers", json={
        "host_name": "Leak Test Host",
        "contact_info": "555-SECRET",
        "city": "Izmir",
        "district": "Konak",
        "address_detail": "Cok gizli adres",
        "capacity": 1,
    })
    assert create_res.status_code == 201
    data = create_res.json()["data"]
    assert "address_detail" not in data
    assert "contact_info" not in data
    assert "host_name" not in data
