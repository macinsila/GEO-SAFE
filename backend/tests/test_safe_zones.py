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
