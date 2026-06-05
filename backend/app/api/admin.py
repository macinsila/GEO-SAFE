"""
Admin-only global endpoints: abuse metrics + activity timeline (GS-083).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.rate_limit import (
    emergency_limiter,
    public_form_dedup,
    shelter_limiter,
    volunteer_limiter,
)
from app.api.response import success_response
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(tags=["admin"])


@router.get("/abuse-metrics")
async def get_abuse_metrics(
    current_user: User = Depends(require_roles("admin")),
):
    return success_response(
        data={
            "rate_limit_blocks": {
                "emergency": emergency_limiter.blocked_count,
                "volunteers": volunteer_limiter.blocked_count,
                "shelter_offers": shelter_limiter.blocked_count,
            },
            "duplicate_rejections": public_form_dedup.rejected_count,
        },
        message="Abuse metrics retrieved",
    )


@router.get("/audit-log")
async def get_audit_log(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    resource_type: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """Paginated audit log for the activity timeline (GS-083)."""
    stmt = select(AuditLog).order_by(desc(AuditLog.created_at))
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)

    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    entries = result.scalars().all()

    return success_response(
        data=[
            {
                "id": e.id,
                "user_email": e.user_email,
                "user_role": e.user_role,
                "action": e.action,
                "resource_type": e.resource_type,
                "resource_id": e.resource_id,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
        message=f"Audit log page {page}",
    )
