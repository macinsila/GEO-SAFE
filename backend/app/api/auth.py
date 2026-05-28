import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.response import success_response
from app.db import get_db
from app.models.user import User
from app.schemas import UserCreate

# --- Ayarlar ---
ALGORITHM = "HS256"
WEAK_JWT_SECRETS = {
    "dev-secret-change-me",
    "change-this-in-production",
    "your-secret-key",
    "secret",
    "changeme",
    "<replace-with-long-random-secret>",
    "replace-with-long-random-secret",
}
MIN_JWT_SECRET_LENGTH = 32
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 saat (kısa ömürlü)
REFRESH_TOKEN_EXPIRE_DAYS = 30  # 30 gün

# --- Yardımcı araçlar ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
router = APIRouter(tags=["auth"])


# --- Şemalar ---
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class RefreshRequest(BaseModel):
    refresh_token: str


# --- Yardımcı fonksiyonlar ---
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def validate_jwt_secret(secret: str | None) -> str:
    if not secret:
        raise RuntimeError("JWT_SECRET is required. Set a long random value before starting the API.")

    normalized = secret.strip()
    if len(normalized) < MIN_JWT_SECRET_LENGTH or normalized.lower() in WEAK_JWT_SECRETS:
        raise RuntimeError(
            "JWT_SECRET is too weak. Use a unique random value with at least "
            f"{MIN_JWT_SECRET_LENGTH} characters."
        )
    return normalized


def _get_jwt_secret() -> str:
    try:
        return validate_jwt_secret(os.getenv("JWT_SECRET"))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=ALGORITHM)


# Keep legacy alias used by tests / other callers
create_token = create_access_token


def _generate_refresh_token() -> tuple[str, datetime]:
    """Return a (token, expires_at) pair for a new refresh token."""
    token = secrets.token_urlsafe(64)
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return token, expires_at

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    try:
        payload = jwt.decode(token, _get_jwt_secret(), algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Geçersiz token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


def require_roles(*allowed_roles: str):
    async def _role_guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _role_guard


# --- Endpoint'ler ---
@router.post("/register", status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password)
    )
    db.add(user)
    await db.flush()
    user_id = user.id
    await db.commit()
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    return success_response(
        data=UserResponse.model_validate(user).model_dump(),
        message="User registered",
    )


@router.post("/token")
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalars().first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı")

    access_token = create_access_token({"sub": user.email, "role": user.role})
    refresh_token, refresh_expires = _generate_refresh_token()

    user.refresh_token = refresh_token
    user.refresh_token_expires_at = refresh_expires
    await db.commit()

    return success_response(
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "refresh_token": refresh_token,
            "refresh_token_expires_at": refresh_expires.isoformat(),
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
        message="Login successful",
    )


@router.post("/refresh")
async def refresh_access_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new access token + rotated refresh token."""
    result = await db.execute(
        select(User).where(User.refresh_token == body.refresh_token)
    )
    user = result.scalars().first()

    if not user or not user.refresh_token_expires_at:
        raise HTTPException(status_code=401, detail="Geçersiz refresh token")

    if datetime.utcnow() > user.refresh_token_expires_at:
        # Expired — clear it and force re-login
        user.refresh_token = None
        user.refresh_token_expires_at = None
        await db.commit()
        raise HTTPException(status_code=401, detail="Refresh token süresi dolmuş, lütfen tekrar giriş yapın")

    # Rotate: issue new pair
    access_token = create_access_token({"sub": user.email, "role": user.role})
    new_refresh_token, refresh_expires = _generate_refresh_token()

    user.refresh_token = new_refresh_token
    user.refresh_token_expires_at = refresh_expires
    await db.commit()

    return success_response(
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "refresh_token": new_refresh_token,
            "refresh_token_expires_at": refresh_expires.isoformat(),
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
        message="Token yenilendi",
    )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalidate the current refresh token (server-side logout)."""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalars().first()
    if user:
        user.refresh_token = None
        user.refresh_token_expires_at = None
        await db.commit()
    return success_response(data={}, message="Oturum kapatıldı")


async def get_optional_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising 401."""
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return success_response(
        data=UserResponse.model_validate(current_user).model_dump(),
        message="Current user fetched",
    )
