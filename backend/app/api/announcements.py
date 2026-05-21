"""
Announcements API endpoints.
Public: GET list of published announcements (optional category filter).
Admin: full CRUD — create, list all, partial update, delete.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.api.auth import require_roles
from app.api.response import success_response
from app.models.announcement import Announcement
from app.models.user import User
from app.schemas import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementPublicResponse,
    AnnouncementAdminResponse,
)

router = APIRouter(tags=["announcements"])


def _serialize_public(ann: Announcement) -> dict:
    return AnnouncementPublicResponse.model_validate(ann).model_dump()


def _serialize_admin(ann: Announcement) -> dict:
    return AnnouncementAdminResponse.model_validate(ann).model_dump()


# ── Public: list published announcements ────────────────────────────────────
@router.get("")
async def list_announcements(
    db: AsyncSession = Depends(get_db),
    kategori: Optional[str] = Query(default=None, description="Filter by category"),
):
    stmt = (
        select(Announcement)
        .where(Announcement.status == "published")
        .order_by(Announcement.published_at.desc())
        .limit(50)
    )
    if kategori is not None:
        stmt = stmt.where(Announcement.kategori == kategori)
    result = await db.execute(stmt)
    return success_response(
        data=[_serialize_public(ann) for ann in result.scalars().all()],
        message="Duyurular listelendi",
    )


# ── Admin: create announcement ───────────────────────────────────────────────
@router.post("", status_code=201)
async def create_announcement(
    payload: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    ann = Announcement(
        title=payload.title,
        content=payload.content,
        kategori=payload.kategori,
        priority=payload.priority,
        status="draft",
        created_by=current_user.id,
    )
    db.add(ann)
    await db.flush()
    ann_id = ann.id
    await db.commit()
    result = await db.execute(select(Announcement).where(Announcement.id == ann_id))
    ann = result.scalar_one()
    return success_response(data=_serialize_admin(ann), message="Duyuru oluşturuldu")


# ── Admin: list all announcements (any status) ───────────────────────────────
@router.get("/admin")
async def list_announcements_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    kategori: Optional[str] = Query(default=None, description="Filter by category"),
):
    stmt = select(Announcement).order_by(Announcement.id.desc())
    if status is not None:
        stmt = stmt.where(Announcement.status == status)
    if kategori is not None:
        stmt = stmt.where(Announcement.kategori == kategori)
    result = await db.execute(stmt)
    return success_response(
        data=[_serialize_admin(ann) for ann in result.scalars().all()],
        message="Tüm duyurular listelendi",
    )


# ── Admin: partial update ────────────────────────────────────────────────────
@router.patch("/{announcement_id}")
async def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    ann = result.scalars().first()
    if ann is None:
        raise HTTPException(status_code=404, detail="Duyuru bulunamadı")

    if payload.title is not None:
        ann.title = payload.title
    if payload.content is not None:
        ann.content = payload.content
    if payload.kategori is not None:
        ann.kategori = payload.kategori
    if payload.priority is not None:
        ann.priority = payload.priority
    if payload.status is not None:
        if payload.status == "published" and ann.published_at is None:
            ann.published_at = datetime.utcnow()
        ann.status = payload.status

    await db.flush()
    ann_id = ann.id
    await db.commit()
    result = await db.execute(select(Announcement).where(Announcement.id == ann_id))
    ann = result.scalar_one()
    return success_response(data=_serialize_admin(ann), message="Duyuru güncellendi")


# ── Admin: delete ─────────────────────────────────────────────────────────────
@router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    ann = result.scalars().first()
    if ann is None:
        raise HTTPException(status_code=404, detail="Duyuru bulunamadı")
    await db.delete(ann)
    await db.commit()
    return success_response(data={"deleted": announcement_id}, message="Duyuru silindi")
