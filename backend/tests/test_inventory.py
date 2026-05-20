from app.api.auth import get_current_user
from app.main import app
from app.models.user import User


def _override_viewer():
    async def _viewer():
        return User(id=2, name="Viewer", email="viewer@test.local", role="viewer")

    return _viewer


def test_add_item_to_warehouse(data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Inventory Depot",
        lon=29.0500,
        lat=41.0500,
        status="active",
        capacity=100,
    )
    item = data_factory["create_item"](name="su", sku="INV-WTR-001", unit="litre")

    created_inventory = data_factory["create_warehouse_inventory"](
        warehouse_id=warehouse["id"],
        item_id=item["id"],
        quantity=35,
    )
    fetched_inventory = data_factory["get_inventory"](
        warehouse_id=warehouse["id"],
        item_id=item["id"],
    )

    assert created_inventory["warehouse_id"] == warehouse["id"]
    assert created_inventory["item_id"] == item["id"]
    assert created_inventory["quantity"] == 35
    assert fetched_inventory is not None
    assert fetched_inventory["quantity"] == 35


def test_admin_item_list_create_and_update_work(client):
    create_response = client.post(
        "/api/v1/inventory/items/admin",
        json={
            "sku": "INV-TENT-001",
            "name": "cadir",
            "unit": "adet",
            "description": "Aile cadiri",
            "low_stock_threshold": 6,
            "is_active": True,
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()["data"]
    assert created["sku"] == "INV-TENT-001"
    assert created["low_stock_threshold"] == 6
    assert created["is_active"] is True

    list_response = client.get("/api/v1/inventory/items/admin")
    assert list_response.status_code == 200
    assert any(row["id"] == created["id"] for row in list_response.json()["data"])

    update_response = client.patch(
        f"/api/v1/inventory/items/admin/{created['id']}",
        json={
            "name": "aile cadiri",
            "low_stock_threshold": 4,
            "is_active": False,
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()["data"]
    assert updated["name"] == "aile cadiri"
    assert updated["low_stock_threshold"] == 4
    assert updated["is_active"] is False


def test_non_admin_item_create_and_update_forbidden(client, data_factory):
    item = data_factory["create_item"](name="admin-item", sku="INV-ADMIN-001", unit="adet")
    original_override = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = _override_viewer()

    try:
        create_response = client.post(
            "/api/v1/inventory/items/admin",
            json={"sku": "INV-FORB-001", "name": "forbidden", "unit": "adet"},
        )
        assert create_response.status_code == 403

        update_response = client.patch(
            f"/api/v1/inventory/items/admin/{item['id']}",
            json={"name": "blocked-update"},
        )
        assert update_response.status_code == 403
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original_override


def test_public_user_cannot_access_admin_inventory_endpoints(client):
    original_override = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = _override_viewer()

    try:
        forbidden_paths = [
            ("get", "/api/v1/inventory/items/admin", None),
            ("get", "/api/v1/inventory/warehouses/admin", None),
            ("get", "/api/v1/inventory/movements/admin", None),
            ("get", "/api/v1/inventory/critical/admin", None),
            ("patch", "/api/v1/inventory/items/admin/1", {"name": "blocked"}),
        ]
        for method, path, payload in forbidden_paths:
            response = getattr(client, method)(path, json=payload) if payload is not None else getattr(client, method)(path)
            assert response.status_code == 403
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original_override


def test_admin_warehouse_inventory_update_works(client, data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Warehouse Admin Depot",
        lon=29.06,
        lat=41.06,
        capacity=100,
    )
    item = data_factory["create_item"](name="generator", sku="INV-GEN-001", unit="adet")

    response = client.patch(
        f"/api/v1/inventory/warehouses/admin/{warehouse['id']}/items/{item['id']}",
        json={"quantity": 18, "movement_type": "adjustment", "note": "restock"},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["warehouse_id"] == warehouse["id"]
    assert payload["item_id"] == item["id"]
    assert payload["quantity"] == 18
    assert payload["is_critical"] is False
    assert data_factory["get_inventory"](warehouse_id=warehouse["id"], item_id=item["id"])["quantity"] == 18


def test_update_warehouse_inventory_rejects_negative_quantity(client, data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Negative Guard Depot",
        lon=29.0800,
        lat=41.0800,
    )
    item = data_factory["create_item"](name="ilac", sku="INV-MED-001", unit="kutu")

    response = client.patch(
        f"/api/v1/inventory/warehouses/admin/{warehouse['id']}/items/{item['id']}",
        json={"quantity": -1},
    )

    assert response.status_code == 422
    assert data_factory["get_inventory"](warehouse_id=warehouse["id"], item_id=item["id"]) is None


def test_inventory_update_creates_movement_log(client, data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Audit Depot",
        lon=29.1100,
        lat=41.1100,
    )
    item = data_factory["create_item"](name="kuru_gida", sku="INV-FOOD-001", unit="paket")

    first_response = client.patch(
        f"/api/v1/inventory/warehouses/admin/{warehouse['id']}/items/{item['id']}",
        json={"quantity": 12, "note": "initial stock"},
    )
    second_response = client.patch(
        f"/api/v1/inventory/warehouses/admin/{warehouse['id']}/items/{item['id']}",
        json={"quantity": 7, "note": "manual correction"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert data_factory["count_inventory_movements"](warehouse_id=warehouse["id"], item_id=item["id"]) == 2

    history_response = client.get("/api/v1/inventory/movements/admin")
    assert history_response.status_code == 200
    movement = next(
        row
        for row in history_response.json()["data"]
        if row["warehouse_id"] == warehouse["id"] and row["item_id"] == item["id"]
    )
    assert movement["old_quantity"] in {12, 0}
    assert movement["new_quantity"] in {12, 7}
    assert movement["movement_type"] == "adjustment"


def test_movement_history_admin_only(client):
    original_override = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = _override_viewer()

    try:
        response = client.get("/api/v1/inventory/movements/admin")
        assert response.status_code == 403
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original_override


def test_critical_stock_endpoint_admin_view_works(client, data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Critical Depot",
        lon=29.1400,
        lat=41.1400,
        status="active",
    )
    safe_item = data_factory["create_item"](name="su", sku="INV-SAFE-001", unit="litre")
    critical_item = data_factory["create_item"](name="battaniye", sku="INV-LOW-001", unit="adet")

    safe_item_response = client.patch(
        f"/api/v1/inventory/items/admin/{safe_item['id']}",
        json={"low_stock_threshold": 5},
    )
    critical_item_response = client.patch(
        f"/api/v1/inventory/items/admin/{critical_item['id']}",
        json={"low_stock_threshold": 8},
    )

    assert safe_item_response.status_code == 200
    assert critical_item_response.status_code == 200

    data_factory["create_warehouse_inventory"](warehouse_id=warehouse["id"], item_id=safe_item["id"], quantity=11)
    data_factory["create_warehouse_inventory"](warehouse_id=warehouse["id"], item_id=critical_item["id"], quantity=4)

    response = client.get("/api/v1/inventory/critical/admin")
    assert response.status_code == 200
    rows = response.json()["data"]

    assert any(row["item_id"] == critical_item["id"] and row["warehouse_id"] == warehouse["id"] for row in rows)
    assert all(row["item_id"] != safe_item["id"] for row in rows)


def test_delete_inventory_item_deactivates_when_history_exists(client, data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Delete Guard Depot",
        lon=29.15,
        lat=41.15,
    )
    item = data_factory["create_item"](name="cadir", sku="INV-DEL-001", unit="adet")

    update_response = client.patch(
        f"/api/v1/inventory/warehouses/admin/{warehouse['id']}/items/{item['id']}",
        json={"quantity": 3},
    )
    assert update_response.status_code == 200

    delete_response = client.delete(f"/api/v1/inventory/items/admin/{item['id']}")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is False

    list_response = client.get("/api/v1/inventory/items/admin")
    listed_item = next(row for row in list_response.json()["data"] if row["id"] == item["id"])
    assert listed_item["is_active"] is False
