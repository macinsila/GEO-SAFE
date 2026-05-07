from app.api.auth import get_current_user
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
