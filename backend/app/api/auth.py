from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas import UserCreate, UserLogin
from app.db import get_db # Burada senin safe_zones'daki gibi get_db kullandım
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    # Email kontrolü
    q = select(User).where(User.email == payload.email)
    result = await db.execute(q)
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Yeni kullanıcı oluştur
    new_user = User(name=payload.name, email=payload.email, password_hash=payload.password)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login", response_model=UserResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    q = select(User).where(User.email == payload.email)
    result = await db.execute(q)
    user = result.scalars().first()
    if not user or user.password_hash != payload.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user