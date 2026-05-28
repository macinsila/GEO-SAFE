import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.response import success_response
from app.db import get_db
from app.models.user import User

router = APIRouter(tags=["profile"])

class ProfileUpdate(BaseModel):
    name: Optional[str] = ""
    blood: Optional[str] = ""
    chronic: Optional[str] = ""
    meds: Optional[str] = ""
    allergy: Optional[str] = ""
    phone: Optional[str] = ""
    disability_notes: Optional[str] = ""
    emergency_contact_name: Optional[str] = ""
    emergency_contact_phone: Optional[str] = ""

@router.get("")
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    data = user.data or {}
    return success_response(data={
        "name": data.get("name", ""),
        "blood": data.get("blood", ""),
        "chronic": data.get("chronic", ""),
        "meds": data.get("meds", ""),
        "allergy": data.get("allergy", ""),
        "phone": data.get("phone", ""),
        "disability_notes": data.get("disability_notes", ""),
        "emergency_contact_name": data.get("emergency_contact_name", ""),
        "emergency_contact_phone": data.get("emergency_contact_phone", ""),
    }, message="Profile fetched")

@router.put("")
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy.orm.attributes import flag_modified
    stmt = select(User).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    new_data = dict(user.data or {})
    new_data["name"] = payload.name
    new_data["blood"] = payload.blood
    new_data["chronic"] = payload.chronic
    new_data["meds"] = payload.meds
    new_data["allergy"] = payload.allergy
    new_data["phone"] = payload.phone
    new_data["disability_notes"] = payload.disability_notes
    new_data["emergency_contact_name"] = payload.emergency_contact_name
    new_data["emergency_contact_phone"] = payload.emergency_contact_phone
    user.data = new_data
    flag_modified(user, "data")

    await db.commit()
    await db.refresh(user)
    return success_response(data={"user_id": user.id}, message="Profil güncellendi")


# ── KVKK / GDPR ─────────────────────────────────────────────────────────────

@router.get("/my-data")
async def export_my_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    KVKK Madde 11 / GDPR Art. 15 — kişisel veri ihracı.
    Kullanıcının sistemde tutulan tüm kişisel verilerini döner.
    """
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    profile_data = user.data or {}
    return success_response(
        data={
            "account": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
            "health_and_contact": {
                "blood": profile_data.get("blood"),
                "chronic": profile_data.get("chronic"),
                "meds": profile_data.get("meds"),
                "allergy": profile_data.get("allergy"),
                "phone": profile_data.get("phone"),
                "disability_notes": profile_data.get("disability_notes"),
                "emergency_contact_name": profile_data.get("emergency_contact_name"),
                "emergency_contact_phone": profile_data.get("emergency_contact_phone"),
            },
            "data_note": (
                "Bu veriler yalnızca afet lojistiği ve koordinasyon amacıyla tutulmaktadır. "
                "KVKK kapsamındaki haklarınız için iletişime geçiniz."
            ),
        },
        message="Kişisel veriler başarıyla dışa aktarıldı",
    )


@router.delete("/me")
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    KVKK Madde 7 / GDPR Art. 17 — silinme hakkı.
    Hesabı anonimleştirir: isim, e-posta hash'lenir, sağlık verisi silinir.
    Referans bütünlüğü korunur (log kayıtları anonim olarak saklanır).
    """
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    # Irreversible anonymization — use a stable hash so DB constraints still hold
    salt = str(user.id) + str(datetime.now(timezone.utc).timestamp())
    anon_suffix = hashlib.sha256(salt.encode()).hexdigest()[:12]
    user.name = f"deleted-{anon_suffix}"
    user.email = f"deleted-{anon_suffix}@anon.local"
    user.password_hash = None
    user.data = None  # wipes all health & contact fields

    await db.commit()
    return success_response(
        data={"anonymized": True},
        message="Hesabınız anonimleştirildi. Kişisel verileriniz silindi.",
    )