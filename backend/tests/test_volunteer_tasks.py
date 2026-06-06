"""
Tests for GS-050: volunteer task board.
Covers create, list, assign, claim, complete, status transitions, and auth guards.
"""

from app.api.auth import get_current_user
from app.main import app
from app.models.user import User

_TASK = {
    "title": "First aid station setup",
    "description": "Set up triage station at Kadıköy park.",
    "location": "Kadıköy",
    "skill_required": "İlk yardım",
    "urgency": "high",
}


def _override_viewer():
    async def _inner():
        return User(id=99, name="Viewer", email="viewer@test.local", role="viewer")
    return _inner


def _with_user(client, user_fn, call_fn):
    original = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = user_fn()
    try:
        return call_fn()
    finally:
        if original is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

def test_create_task_succeeds(client):
    res = client.post("/api/v1/volunteer-tasks", json=_TASK)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["title"] == _TASK["title"]
    assert data["status"] == "open"
    assert data["urgency"] == "high"
    assert data["assigned_to_id"] is None


def test_create_task_requires_coordinator(client):
    res = _with_user(client, _override_viewer, lambda: client.post("/api/v1/volunteer-tasks", json=_TASK))
    assert res.status_code == 403


def test_create_task_invalid_urgency(client):
    res = client.post("/api/v1/volunteer-tasks", json={**_TASK, "urgency": "extreme"})
    assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Admin list
# ─────────────────────────────────────────────────────────────────────────────

def test_admin_list_tasks(client):
    client.post("/api/v1/volunteer-tasks", json=_TASK)
    client.post("/api/v1/volunteer-tasks", json={**_TASK, "title": "Task B", "urgency": "low"})
    res = client.get("/api/v1/volunteer-tasks/admin")
    assert res.status_code == 200
    assert len(res.json()["data"]) >= 2


def test_admin_list_filter_by_status(client):
    client.post("/api/v1/volunteer-tasks", json=_TASK)
    res = client.get("/api/v1/volunteer-tasks/admin?status=open")
    assert res.status_code == 200
    for t in res.json()["data"]:
        assert t["status"] == "open"


def test_admin_list_filter_by_urgency(client):
    client.post("/api/v1/volunteer-tasks", json={**_TASK, "urgency": "critical"})
    res = client.get("/api/v1/volunteer-tasks/admin?urgency=critical")
    assert res.status_code == 200
    for t in res.json()["data"]:
        assert t["urgency"] == "critical"


def test_admin_list_requires_coordinator(client):
    res = _with_user(client, _override_viewer, lambda: client.get("/api/v1/volunteer-tasks/admin"))
    assert res.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Assign
# ─────────────────────────────────────────────────────────────────────────────

def test_assign_task_sets_in_progress(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    res = client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/assign", json={"assigned_to_id": 1})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["assigned_to_id"] == 1
    assert data["status"] == "in_progress"


def test_unassign_task_reverts_to_open(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/assign", json={"assigned_to_id": 1})
    res = client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/assign", json={"assigned_to_id": None})
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "open"


def test_assign_terminal_task_fails(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/status", json={"status": "done"})
    res = client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/assign", json={"assigned_to_id": 1})
    assert res.status_code == 422


def test_assign_not_found(client):
    res = client.patch("/api/v1/volunteer-tasks/admin/999999/assign", json={"assigned_to_id": 1})
    assert res.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Admin force-status
# ─────────────────────────────────────────────────────────────────────────────

def test_admin_cancel_task(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    res = client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/status", json={"status": "cancelled"})
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "cancelled"


def test_admin_status_invalid(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    res = client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/status", json={"status": "archived"})
    assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Open task list (any authenticated user)
# ─────────────────────────────────────────────────────────────────────────────

def test_open_task_list(client):
    client.post("/api/v1/volunteer-tasks", json=_TASK)
    res = _with_user(client, _override_viewer, lambda: client.get("/api/v1/volunteer-tasks"))
    assert res.status_code == 200
    for t in res.json()["data"]:
        assert t["status"] == "open"


# ─────────────────────────────────────────────────────────────────────────────
# Claim
# ─────────────────────────────────────────────────────────────────────────────

def test_claim_open_task(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]

    def _viewer_fn():
        async def _inner():
            return User(id=99, name="Viewer", email="viewer@test.local", role="viewer")
        return _inner

    res = _with_user(client, _viewer_fn, lambda: client.patch(f"/api/v1/volunteer-tasks/{task_id}/claim"))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "in_progress"
    assert data["assigned_to_id"] == 99


def test_claim_non_open_task_fails(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/status", json={"status": "cancelled"})
    res = _with_user(client, _override_viewer, lambda: client.patch(f"/api/v1/volunteer-tasks/{task_id}/claim"))
    assert res.status_code == 409


# ─────────────────────────────────────────────────────────────────────────────
# Complete
# ─────────────────────────────────────────────────────────────────────────────

def test_complete_assigned_task(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/assign", json={"assigned_to_id": 1})
    res = client.patch(f"/api/v1/volunteer-tasks/{task_id}/complete")
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "done"


def test_complete_task_only_by_assignee(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/assign", json={"assigned_to_id": 1})

    res = _with_user(client, _override_viewer, lambda: client.patch(f"/api/v1/volunteer-tasks/{task_id}/complete"))
    assert res.status_code == 403


def test_complete_non_in_progress_fails(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    res = client.patch(f"/api/v1/volunteer-tasks/{task_id}/complete")
    assert res.status_code in (403, 422)


# ─────────────────────────────────────────────────────────────────────────────
# My tasks
# ─────────────────────────────────────────────────────────────────────────────

def test_my_tasks_returns_assigned_tasks(client):
    task_id = client.post("/api/v1/volunteer-tasks", json=_TASK).json()["data"]["id"]
    client.patch(f"/api/v1/volunteer-tasks/admin/{task_id}/assign", json={"assigned_to_id": 1})

    res = client.get("/api/v1/volunteer-tasks/my")
    assert res.status_code == 200
    ids = [t["id"] for t in res.json()["data"]]
    assert task_id in ids
