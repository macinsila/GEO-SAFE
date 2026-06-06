"""
Volunteer task board API — GS-050.
Coordinators (admin/operator) create and assign tasks.
Any authenticated user can view open tasks, claim one, and mark it done.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_roles
from app.api.response import success_response
from app.db import get_db
from app.models.user import User
from app.models.volunteer_application import VolunteerApplication
from app.models.volunteer_task import VolunteerTask
from app.schemas import (
    VolunteerMatchCandidate,
    VolunteerTaskAssign,
    VolunteerTaskCreate,
    VolunteerTaskResponse,
    VolunteerTaskStatusUpdate,
)

router = APIRouter(tags=["volunteer-tasks"])

_TERMINAL = frozenset({"done", "cancelled"})


def _serialize(task: VolunteerTask) -> dict:
    return VolunteerTaskResponse.model_validate(task).model_dump()


# ── Coordinator: create ─────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_task(
    payload: VolunteerTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    task = VolunteerTask(
        title=payload.title,
        description=payload.description,
        location=payload.location,
        skill_required=payload.skill_required,
        urgency=payload.urgency,
        status="open",
        created_by_id=current_user.id,
    )
    db.add(task)
    await db.flush()
    task_id = task.id
    await db.commit()
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalar_one()
    return success_response(data=_serialize(task), message="Task created")


# ── Coordinator: list all tasks ─────────────────────────────────────────────

@router.get("/admin")
async def list_tasks_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
    status: str | None = None,
    urgency: str | None = None,
):
    stmt = select(VolunteerTask).order_by(VolunteerTask.id.desc())
    if status:
        stmt = stmt.where(VolunteerTask.status == status)
    if urgency:
        stmt = stmt.where(VolunteerTask.urgency == urgency)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return success_response(data=[_serialize(t) for t in tasks], message="Tasks listed")


# ── Coordinator: assign a task to a user ────────────────────────────────────

@router.patch("/admin/{task_id}/assign")
async def assign_task(
    task_id: int,
    payload: VolunteerTaskAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalars().first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status in _TERMINAL:
        raise HTTPException(status_code=422, detail=f"Cannot assign a task with status '{task.status}'")

    task.assigned_to_id = payload.assigned_to_id
    task.status = "in_progress" if payload.assigned_to_id else "open"
    await db.flush()
    task_id = task.id
    await db.commit()
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalar_one()
    return success_response(data=_serialize(task), message="Task assigned")


# ── Coordinator: force-update status (including cancel) ─────────────────────

@router.patch("/admin/{task_id}/status")
async def update_task_status_admin(
    task_id: int,
    payload: VolunteerTaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalars().first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = payload.status
    await db.flush()
    task_id = task.id
    await db.commit()
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalar_one()
    return success_response(data=_serialize(task), message="Task status updated")


# ── Any authenticated user: list open tasks ──────────────────────────────────

@router.get("")
async def list_open_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(VolunteerTask)
        .where(VolunteerTask.status == "open")
        .order_by(VolunteerTask.id.desc())
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return success_response(data=[_serialize(t) for t in tasks], message="Open tasks listed")


# ── Any authenticated user: my assigned tasks ────────────────────────────────

@router.get("/my")
async def list_my_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(VolunteerTask)
        .where(VolunteerTask.assigned_to_id == current_user.id)
        .order_by(VolunteerTask.id.desc())
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return success_response(data=[_serialize(t) for t in tasks], message="My tasks listed")


# ── Any authenticated user: claim an open task ───────────────────────────────

@router.patch("/{task_id}/claim")
async def claim_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalars().first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "open":
        raise HTTPException(status_code=409, detail="Task is not open for claiming")

    task.assigned_to_id = current_user.id
    task.status = "in_progress"
    await db.flush()
    task_id = task.id
    await db.commit()
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalar_one()
    return success_response(data=_serialize(task), message="Task claimed")


# ── Assigned user: mark their task done ──────────────────────────────────────

@router.patch("/{task_id}/complete")
async def complete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalars().first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned volunteer can complete this task")
    if task.status != "in_progress":
        raise HTTPException(status_code=422, detail=f"Cannot complete a task with status '{task.status}'")

    task.status = "done"
    await db.flush()
    task_id = task.id
    await db.commit()
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalar_one()
    return success_response(data=_serialize(task), message="Task completed")


# ── Coordinator: matching volunteer candidates for a task ────────────────────

@router.get("/{task_id}/candidates")
async def get_task_candidates(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    result = await db.execute(select(VolunteerTask).where(VolunteerTask.id == task_id))
    task = result.scalars().first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    result = await db.execute(
        select(VolunteerApplication).where(VolunteerApplication.status == "approved")
    )
    volunteers = result.scalars().all()

    skill = (task.skill_required or "").strip().lower()
    if skill:
        matched = [
            v for v in volunteers
            if skill in [s.lower() for s in (v.skills or [])]
            or skill == (v.primary_role or "").lower()
        ]
    else:
        matched = list(volunteers)

    return success_response(
        data=[VolunteerMatchCandidate.model_validate(v).model_dump() for v in matched],
        message=f"{len(matched)} candidate(s) found",
    )
