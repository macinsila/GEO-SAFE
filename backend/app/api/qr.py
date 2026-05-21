from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from app.db import get_db
from app.models.user import User
from app.api.auth import get_current_user
from app.api.response import success_response

router = APIRouter(tags=["qr"])


def _mask_name(full_name: str) -> str:
    parts = full_name.strip().split()
    if not parts:
        return "Kullanici"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


@router.get("/identity")
async def get_qr_identity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    data = (user.data or {}) if user else {}
    name = data.get("name", "") or current_user.name or ""

    payload = {
        "v": 1,
        "name": _mask_name(name),
        "blood": (data.get("blood", "") or "")[:50],
        "allergies": (data.get("allergy", "") or "")[:200],
        "medications": (data.get("meds", "") or "")[:200],
        "conditions": (data.get("chronic", "") or "")[:200],
        "disability": (data.get("disability_notes", "") or "")[:200],
        "issued": str(date.today()),
    }

    return success_response(
        data={
            "qr_payload": payload,
            "display_name": _mask_name(name),
            "issued_at": str(date.today()),
        },
        message="QR kimlik verisi hazir",
    )
