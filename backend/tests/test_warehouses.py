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
