def test_create_warehouse_success(client):
    payload = {
        "name": "Merkez Depo",
        "address": "Test Mahallesi 1",
        "capacity": 1000,
        "status": "active",
        "location": {"type": "Point", "coordinates": [29.01, 41.01]},
    }

    response = client.post("/api/v1/warehouses", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert body["data"]["name"] == payload["name"]
    assert body["message"] == "Warehouse created"


def test_public_warehouse_response_excludes_private_address_and_raw_data(client):
    create_payload = {
        "name": "Public Sanitized Depot",
        "address": "Sensitive Operations Street 10",
        "capacity": 500,
        "status": "active",
        "location": {"type": "Point", "coordinates": [29.02, 41.02]},
    }
    create_response = client.post("/api/v1/warehouses", json=create_payload)
    assert create_response.status_code == 201
    warehouse_id = create_response.json()["data"]["id"]

    detail_response = client.get(f"/api/v1/warehouses/{warehouse_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]
    assert "address" not in detail
    assert "data" not in detail

    list_response = client.get("/api/v1/warehouses")
    assert list_response.status_code == 200
    listed = next(item for item in list_response.json()["data"] if item["id"] == warehouse_id)
    assert "address" not in listed
    assert "data" not in listed


def test_admin_warehouse_response_can_include_private_details(client):
    create_payload = {
        "name": "Admin Detail Depot",
        "address": "Admin Only Street 5",
        "capacity": 250,
        "status": "active",
        "location": {"type": "Point", "coordinates": [29.03, 41.03]},
    }
    create_response = client.post("/api/v1/warehouses", json=create_payload)
    assert create_response.status_code == 201

    admin_response = client.get("/api/v1/warehouses/admin")
    assert admin_response.status_code == 200
    admin_rows = admin_response.json()["data"]
    row = next(item for item in admin_rows if item["name"] == create_payload["name"])
    assert row["address"] == create_payload["address"]
    assert "data" in row


def test_get_warehouse_not_found(client):
    response = client.get("/api/v1/warehouses/999999")

    assert response.status_code == 404
    body = response.json()
    assert body["status"] == "error"
    assert "not found" in body["message"].lower()


def test_update_warehouse_status(client):
    create_payload = {
        "name": "Guncellenecek Depo",
        "address": "Test Sokak",
        "capacity": 300,
        "status": "active",
        "location": {"type": "Point", "coordinates": [29.10, 41.10]},
    }
    create_response = client.post("/api/v1/warehouses", json=create_payload)
    assert create_response.status_code == 201

    warehouse_id = create_response.json()["data"]["id"]

    update_payload = {
        "name": "Guncellenecek Depo",
        "address": "Test Sokak",
        "capacity": 300,
        "status": "inactive",
        "location": {"type": "Point", "coordinates": [29.10, 41.10]},
    }
    update_response = client.put(f"/api/v1/warehouses/{warehouse_id}", json=update_payload)

    assert update_response.status_code == 200
    body = update_response.json()
    assert body["status"] == "success"
    assert body["data"]["status"] == "inactive"
