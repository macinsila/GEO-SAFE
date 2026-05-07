import pytest


@pytest.mark.parametrize("radius_km", [10.0])
def test_nearest_depot_found(client, data_factory, radius_km):
    near = data_factory["create_warehouse"](
        name="Near Depot",
        lon=29.0000,
        lat=41.0000,
        status="active",
    )
    far = data_factory["create_warehouse"](
        name="Far Depot",
        lon=29.3000,
        lat=41.2500,
        status="active",
    )

    item = data_factory["create_item"](name="battaniye", sku="BAT-001", unit="adet")
    data_factory["create_warehouse_inventory"](warehouse_id=near["id"], item_id=item["id"], quantity=50)
    data_factory["create_warehouse_inventory"](warehouse_id=far["id"], item_id=item["id"], quantity=50)

    response = client.get(
        "/api/v1/spatial/nearest-depot",
        params={"lat": 41.005, "lon": 29.005, "item_name": "battaniye", "radius_km": radius_km},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["data"]
    assert payload["data"][0]["depot"]["id"] == near["id"]

    distance_km = payload["data"][0]["distance_km"]
    assert distance_km >= 0
    assert distance_km < 5


def test_nearest_depot_no_item(client, data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Only Food Depot",
        lon=29.1000,
        lat=41.1000,
        status="active",
    )
    food_item = data_factory["create_item"](name="su", sku="WTR-001", unit="litre")
    data_factory["create_warehouse_inventory"](
        warehouse_id=warehouse["id"],
        item_id=food_item["id"],
        quantity=20,
    )

    response = client.get(
        "/api/v1/spatial/nearest-depot",
        params={"lat": 41.0, "lon": 29.0, "item_name": "battaniye", "radius_km": 20},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["data"] == []
    assert "No active depot found" in payload["message"]


def test_nearest_depot_inactive_warehouse(client, data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Inactive Depot",
        lon=29.0000,
        lat=41.0000,
        status="inactive",
    )
    item = data_factory["create_item"](name="battaniye", sku="BAT-002", unit="adet")
    data_factory["create_warehouse_inventory"](
        warehouse_id=warehouse["id"],
        item_id=item["id"],
        quantity=50,
    )

    response = client.get(
        "/api/v1/spatial/nearest-depot",
        params={"lat": 41.0, "lon": 29.0, "item_name": "battaniye", "radius_km": 20},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["data"] == []


def test_nearest_depot_outside_radius(client, data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Very Far Depot",
        lon=31.0000,
        lat=43.0000,
        status="active",
    )
    item = data_factory["create_item"](name="battaniye", sku="BAT-003", unit="adet")
    data_factory["create_warehouse_inventory"](
        warehouse_id=warehouse["id"],
        item_id=item["id"],
        quantity=50,
    )

    response = client.get(
        "/api/v1/spatial/nearest-depot",
        params={"lat": 41.0, "lon": 29.0, "item_name": "battaniye", "radius_km": 5},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["data"] == []


def test_nearest_depot_invalid_coords(client):
    response = client.get(
        "/api/v1/spatial/nearest-depot",
        params={"lat": 999, "lon": 999, "item_name": "battaniye", "radius_km": 10},
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["detail"]
