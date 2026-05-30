"""
Tests for GS-080: KPI summary endpoint.
"""


def test_kpi_summary_structure(client):
    res = client.get("/api/v1/kpi/summary")
    assert res.status_code == 200
    data = res.json()["data"]

    assert "emergencies" in data
    assert "tasks" in data
    assert "warehouses" in data
    assert "safe_zones" in data
    assert "critical_stock_count" in data
    assert "volunteer_applications_pending" in data


def test_kpi_emergency_counts(client, data_factory):
    from app.api.rate_limit import emergency_limiter
    emergency_limiter._buckets.clear()

    client.post(
        "/api/v1/emergency",
        json={
            "durum": "Enkaz Altindayim",
            "saat": "2026-05-31 10:00",
            "harita_link": "https://maps.example.com",
            "enlem": 41.01,
            "boylam": 29.01,
        },
    )
    res = client.get("/api/v1/kpi/summary")
    assert res.json()["data"]["emergencies"]["total"] >= 1
    assert res.json()["data"]["emergencies"]["new"] >= 1


def test_kpi_warehouse_counts(client, data_factory):
    data_factory["create_warehouse"](name="KPI Depot 1", lon=29.0, lat=41.0, status="active")
    data_factory["create_warehouse"](name="KPI Depot 2", lon=29.1, lat=41.1, status="inactive")

    res = client.get("/api/v1/kpi/summary")
    d = res.json()["data"]
    assert d["warehouses"]["total"] >= 2
    assert d["warehouses"]["active"] >= 1


def test_kpi_zero_state(client):
    res = client.get("/api/v1/kpi/summary")
    assert res.status_code == 200
    data = res.json()["data"]
    # All counts are non-negative integers
    assert data["emergencies"]["total"] >= 0
    assert data["tasks"]["total"] >= 0
    assert data["critical_stock_count"] >= 0
