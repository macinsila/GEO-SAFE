"""
Volunteer intake API endpoints
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.auth import require_roles
from app.api.rate_limit import volunteer_limiter, public_form_dedup
from app.api.response import success_response
from app.db import get_db
from app.models.user import User
from app.models.volunteer_application import VolunteerApplication
from app.schemas import (
    VolunteerCreate,
    VolunteerPublicResponse,
    VolunteerAdminResponse,
    VolunteerStatusUpdate,
)

router = APIRouter(tags=["volunteers"])


def _serialize_public(volunteer: VolunteerApplication) -> dict:
    return VolunteerPublicResponse.model_validate(volunteer).model_dump()


def _serialize_admin(volunteer: VolunteerApplication) -> dict:
    return VolunteerAdminResponse.model_validate(volunteer).model_dump()


@router.post("", status_code=201)
async def create_volunteer_application(
    payload: VolunteerCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await volunteer_limiter.check(request)
    await public_form_dedup.check(request, payload.model_dump())
    volunteer = VolunteerApplication(
        full_name=payload.full_name,
        contact_info=payload.contact_info,
        district=payload.district,
        neighborhood=payload.neighborhood,
        skills=payload.skills,
        availability_note=payload.availability_note,
        status="pending",
    )
    db.add(volunteer)
    await db.flush()
    volunteer_id = volunteer.id
    await db.commit()
    result = await db.execute(
        select(VolunteerApplication).where(VolunteerApplication.id == volunteer_id)
    )
    volunteer = result.scalar_one()

    return success_response(
        data=_serialize_public(volunteer),
        message="Volunteer application received",
    )


@router.get("/admin")
async def list_volunteer_applications_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
    status: Optional[str] = Query(default=None, description="Filter by status"),
):
    stmt = select(VolunteerApplication).order_by(VolunteerApplication.id.desc())
    if status is not None:
        stmt = stmt.where(VolunteerApplication.status == status)
    result = await db.execute(stmt)
    volunteers = result.scalars().all()

    return success_response(
        data=[_serialize_admin(volunteer) for volunteer in volunteers],
        message="Volunteer applications listed",
    )


@router.patch("/admin/{volunteer_id}/status")
async def update_volunteer_status(
    volunteer_id: int,
    payload: VolunteerStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(
        select(VolunteerApplication).where(VolunteerApplication.id == volunteer_id)
    )
    volunteer = result.scalars().first()
    if volunteer is None:
        raise HTTPException(status_code=404, detail="Volunteer application not found")

    volunteer.status = payload.status
    await db.flush()
    volunteer_id = volunteer.id
    await db.commit()
    result = await db.execute(
        select(VolunteerApplication).where(VolunteerApplication.id == volunteer_id)
    )
    volunteer = result.scalar_one()

    return success_response(
        data=_serialize_admin(volunteer),
        message="Volunteer status updated",
    )
