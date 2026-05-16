import pytest

from app.api.auth import get_current_user, validate_jwt_secret
from app.main import app
from app.models.user import User


def test_admin_required_for_warehouse_create(client):
    async def _override_current_user_viewer():
        return User(id=2, name="Viewer", email="viewer@test.local", role="viewer")

    original_override = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = _override_current_user_viewer

    payload = {
        "name": "Role Test Depot",
        "address": "Role Test",
        "capacity": 10,
        "status": "active",
        "location": {"type": "Point", "coordinates": [29.01, 41.01]},
    }

    try:
        response = client.post("/api/v1/warehouses", json=payload)
        assert response.status_code == 403
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original_override


def test_jwt_secret_rejects_missing_or_weak_values():
    for weak_secret in (None, "", "dev-secret-change-me", "change-this-in-production"):
        with pytest.raises(RuntimeError):
            validate_jwt_secret(weak_secret)


def test_register_response_does_not_expose_password_hash(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Sanitized User",
            "email": "sanitized@example.com",
            "password": "safe-password-123",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert body["data"]["email"] == "sanitized@example.com"
    assert "password_hash" not in body["data"]
    assert "data" not in body["data"]


def test_me_response_does_not_expose_password_hash_or_profile_data(client):
    async def _override_current_user_with_private_fields():
        return User(
            id=10,
            name="Private User",
            email="private@test.local",
            role="operator",
            password_hash="hashed-secret",
            data={"phone": "555-0100"},
        )

    original_override = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = _override_current_user_with_private_fields

    try:
        response = client.get("/api/v1/auth/me")
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original_override

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == {
        "id": 10,
        "name": "Private User",
        "email": "private@test.local",
        "role": "operator",
    }
