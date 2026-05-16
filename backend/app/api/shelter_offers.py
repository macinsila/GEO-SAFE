"""
Shelter offer intake API endpoints
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.auth import require_roles
from app.api.response import success_response
from app.db import get_db
from app.models.user import User
from app.models.shelter_offer import ShelterOffer
from app.schemas import (
    ShelterOfferCreate,
    ShelterOfferPublicResponse,
    ShelterOfferAdminResponse,
    ShelterStatusUpdate,
)

router = APIRouter(tags=["shelter-offers"])


def _serialize_public(offer: ShelterOffer) -> dict:
    return ShelterOfferPublicResponse.model_validate(offer).model_dump()


def _serialize_admin(offer: ShelterOffer) -> dict:
    return ShelterOfferAdminResponse.model_validate(offer).model_dump()


@router.post("", status_code=201)
async def create_shelter_offer(
    payload: ShelterOfferCreate,
    db: AsyncSession = Depends(get_db),
):
    offer = ShelterOffer(
        host_name=payload.host_name,
        contact_info=payload.contact_info,
        city=payload.city,
        district=payload.district,
        neighborhood=payload.neighborhood,
        address_detail=payload.address_detail,
        capacity=payload.capacity,
        available_from=payload.available_from,
        available_until=payload.available_until,
        duration_note=payload.duration_note,
        household_notes=payload.household_notes,
        suitability_notes=payload.suitability_notes,
        status="pending",
    )
    db.add(offer)
    await db.flush()
    offer_id = offer.id
    await db.commit()
    result = await db.execute(
        select(ShelterOffer).where(ShelterOffer.id == offer_id)
    )
    offer = result.scalar_one()

    return success_response(
        data=_serialize_public(offer),
        message="Shelter offer received",
    )


@router.get("/admin")
async def list_shelter_offers_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
    status: Optional[str] = Query(default=None, description="Filter by status"),
):
    stmt = select(ShelterOffer).order_by(ShelterOffer.id.desc())
    if status is not None:
        stmt = stmt.where(ShelterOffer.status == status)
    result = await db.execute(stmt)
    offers = result.scalars().all()

    return success_response(
        data=[_serialize_admin(offer) for offer in offers],
        message="Shelter offers listed",
    )


@router.patch("/admin/{offer_id}/status")
async def update_shelter_offer_status(
    offer_id: int,
    payload: ShelterStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(
        select(ShelterOffer).where(ShelterOffer.id == offer_id)
    )
    offer = result.scalars().first()
    if offer is None:
        raise HTTPException(status_code=404, detail="Shelter offer not found")

    offer.status = payload.status
    await db.flush()
    offer_id = offer.id
    await db.commit()
    result = await db.execute(
        select(ShelterOffer).where(ShelterOffer.id == offer_id)
    )
    offer = result.scalar_one()

    return success_response(
        data=_serialize_admin(offer),
        message="Shelter offer status updated",
    )
