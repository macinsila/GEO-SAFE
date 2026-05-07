from app.api.rate_limit import emergency_limiter


def test_emergency_reports_persist(client):
    emergency_limiter._buckets.clear()
    payload = {
        "durum": "Test Alarm",
        "saat": "2026-05-06 10:00",
        "harita_link": "https://maps.example.com",
        "enlem": 41.01,
        "boylam": 29.01,
    }

    create_res = client.post("/api/v1/emergency", json=payload)
    assert create_res.status_code == 201

    list_res = client.get("/api/v1/emergency")
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["status"] == "success"
    assert body["data"]


def test_emergency_rate_limited(client):
    emergency_limiter._buckets.clear()
    payload = {
        "durum": "Rate Limit Test",
        "saat": "2026-05-06 10:05",
        "harita_link": "https://maps.example.com",
        "enlem": 41.01,
        "boylam": 29.01,
    }

    for _ in range(emergency_limiter.max_requests):
        response = client.post("/api/v1/emergency", json=payload)
        assert response.status_code == 201

    blocked = client.post("/api/v1/emergency", json=payload)
    assert blocked.status_code == 429
