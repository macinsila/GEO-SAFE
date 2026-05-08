from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.db import get_db
from app.models.user import User
from app.api.auth import get_current_user
from app.api.response import success_response

router = APIRouter(tags=["profile"])

class ProfileUpdate(BaseModel):
    name: Optional[str] = ""
    blood: Optional[str] = ""
    chronic: Optional[str] = ""
    meds: Optional[str] = ""
    allergy: Optional[str] = ""
    phone: Optional[str] = ""

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
        "phone": data.get("phone", "")
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
    user.data = new_data
    flag_modified(user, "data")

    await db.commit()
    await db.refresh(user)
    return success_response(data={"user_id": user.id}, message="Profil güncellendi")