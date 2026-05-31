"""Tests for GS-061: Bulk import of warehouses and safe zones."""

import pytest
from unittest.mock import patch


# ── Warehouse import ───────────────────────────────────────────────────────────

def test_import_warehouses_creates_new(client):
    payload = [{"name": "Import-WH-001", "address": "Test Addr", "status": "active"}]
    r = client.post("/api/v1/admin/import/warehouses", json=payload)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["created"] == 1
    assert data["updated"] == 0
    assert data["skipped"] == 0
    assert data["errors"] == []


def test_import_warehouses_updates_existing(client):
    name = "Import-WH-Update"
    client.post("/api/v1/admin/import/warehouses", json=[{"name": name, "address": "Addr1", "status": "active"}])
    r = client.post("/api/v1/admin/import/warehouses", json=[{"name": name, "address": "Addr2", "status": "active"}])
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["updated"] == 1
    assert data["created"] == 0


def test_import_warehouses_skips_unchanged(client):
    name = "Import-WH-Skip"
    payload = [{"name": name, "address": "Addr", "status": "active"}]
    client.post("/api/v1/admin/import/warehouses", json=payload)
    r = client.post("/api/v1/admin/import/warehouses", json=payload)
    data = r.json()["data"]
    assert data["skipped"] == 1
    assert data["created"] == 0
    assert data["updated"] == 0


def test_import_warehouses_dry_run_does_not_commit(client):
    payload = [{"name": "Import-WH-DryRun-XYZ", "status": "active"}]
    r = client.post("/api/v1/admin/import/warehouses?dry_run=true", json=payload)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["created"] == 1
    assert "[DRY RUN]" in r.json()["message"]

    # Same payload dry_run again — should still report created=1 since nothing was committed
    r2 = client.post("/api/v1/admin/import/warehouses?dry_run=true", json=payload)
    assert r2.json()["data"]["created"] == 1


def test_import_warehouses_validates_lat_without_lon(client):
    payload = [{"name": "Import-WH-LatOnly", "lat": 41.0, "status": "active"}]
    r = client.post("/api/v1/admin/import/warehouses", json=payload)
    assert r.status_code == 422


def test_import_warehouses_with_location(client):
    payload = [{"name": "Import-WH-WithLoc-XYZ", "lat": 41.01, "lon": 29.02, "status": "active"}]
    r = client.post("/api/v1/admin/import/warehouses", json=payload)
    assert r.status_code == 200
    assert r.json()["data"]["created"] == 1


def test_import_warehouses_max_500(client):
    payload = [{"name": f"Bulk-WH-{i}", "status": "active"} for i in range(501)]
    r = client.post("/api/v1/admin/import/warehouses", json=payload)
    assert r.status_code == 422


def test_import_warehouses_multiple_rows(client):
    payload = [
        {"name": "Import-Multi-A", "status": "active"},
        {"name": "Import-Multi-B", "status": "inactive"},
        {"name": "Import-Multi-C", "status": "maintenance"},
    ]
    r = client.post("/api/v1/admin/import/warehouses", json=payload)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["created"] == 3
    assert data["errors"] == []


# ── Safe zone import ───────────────────────────────────────────────────────────

def test_import_safe_zones_creates(client):
    payload = [{"name": "Import-SZ-001-XYZ", "capacity": 200, "status": "active"}]
    r = client.post("/api/v1/admin/import/safe-zones", json=payload)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["created"] == 1
    assert data["errors"] == []


def test_import_safe_zones_updates(client):
    name = "Import-SZ-Update-XYZ"
    client.post("/api/v1/admin/import/safe-zones", json=[{"name": name, "capacity": 100, "status": "active"}])
    r = client.post("/api/v1/admin/import/safe-zones", json=[{"name": name, "capacity": 200, "status": "active"}])
    assert r.json()["data"]["updated"] == 1


def test_import_safe_zones_dry_run(client):
    payload = [{"name": "Import-SZ-DryRun-XYZ", "status": "active"}]
    r = client.post("/api/v1/admin/import/safe-zones?dry_run=true", json=payload)
    assert r.status_code == 200
    assert r.json()["data"]["created"] == 1
    assert "[DRY RUN]" in r.json()["message"]


def test_import_safe_zones_with_location(client):
    payload = [{"name": "Import-SZ-Loc-XYZ", "lat": 41.0, "lon": 29.0, "status": "active"}]
    r = client.post("/api/v1/admin/import/safe-zones", json=payload)
    assert r.status_code == 200
    assert r.json()["data"]["created"] == 1
