"""
Admin-only global endpoints: abuse metrics.
"""

from fastapi import APIRouter, Depends

from app.api.auth import require_roles
from app.api.rate_limit import (
    emergency_limiter,
    volunteer_limiter,
    shelter_limiter,
    public_form_dedup,
)
from app.api.response import success_response
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
