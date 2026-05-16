def test_create_safe_zone_stores_geometry(client):
    payload = {
        "name": "Test Zone",
        "capacity": 150,
        "status": "active",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [29.0, 41.0],
                [29.1, 41.0],
                [29.1, 41.1],
                [29.0, 41.1]
            ]],
        },
    }

    response = client.post("/api/v1/safe-zones", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert body["data"]["geometry"]["type"] == "Polygon"


def test_public_safe_zone_response_excludes_raw_data(client):
    payload = {
        "name": "Sanitized Zone",
        "capacity": 120,
        "status": "active",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [29.2, 41.2],
                [29.3, 41.2],
                [29.3, 41.3],
                [29.2, 41.3],
            ]],
        },
    }
    create_response = client.post("/api/v1/safe-zones", json=payload)
    assert create_response.status_code == 201
    zone_id = create_response.json()["data"]["id"]

    detail_response = client.get(f"/api/v1/safe-zones/{zone_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]
    assert "data" not in detail
    assert detail["geometry"]["type"] == "Polygon"

    list_response = client.get("/api/v1/safe-zones")
    assert list_response.status_code == 200
    listed = next(item for item in list_response.json()["data"] if item["id"] == zone_id)
    assert "data" not in listed
