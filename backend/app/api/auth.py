import hashlib
import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class RoleUpdateRequest(BaseModel):
    role: str


# --- Yardımcı fonksiyonlar ---
_VALID_ROLES = {"citizen", "volunteer", "operator", "admin"}
_VERIFICATION_TOKEN_EXPIRE_HOURS = 24
_RESET_TOKEN_EXPIRE_HOURS = 1


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _hash_token(token: str) -> str:
    """SHA-256 bir token'ı DB'de güvenli saklamak için."""
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_verification_token() -> tuple[str, str, datetime]:
    """(raw_token, hashed_token, expires_at) döndürür."""
    raw = secrets.token_urlsafe(48)
    return raw, _hash_token(raw), datetime.utcnow() + timedelta(hours=_VERIFICATION_TOKEN_EXPIRE_HOURS)


def _generate_reset_token() -> tuple[str, str, datetime]:
    """(raw_token, hashed_token, expires_at) döndürür."""
    raw = secrets.token_urlsafe(48)
    return raw, _hash_token(raw), datetime.utcnow() + timedelta(hours=_RESET_TOKEN_EXPIRE_HOURS)


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

    raw_token, hashed_token, expires_at = _generate_verification_token()
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="citizen",
        email_verified=False,
        email_verification_token=hashed_token,
        email_verification_expires_at=expires_at,
    )
    db.add(user)
    await db.flush()
    user_id = user.id
    await db.commit()

    # E-posta gönderimi (yapılandırılmamışsa atlanır)
    try:
        from app.core.email import send_verification_email
        await send_verification_email(payload.email, raw_token)
    except Exception:
        pass  # E-posta hatası kayıt işlemini engellemez

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    return success_response(
        data=UserResponse.model_validate(user).model_dump(),
        message="Kayıt başarılı. E-posta doğrulama bağlantısı gönderildi.",
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


# ── GS-011: E-posta doğrulama ─────────────────────────────────────────────────

@router.post("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    hashed = _hash_token(token)
    result = await db.execute(
        select(User).where(User.email_verification_token == hashed)
    )
    user = result.scalars().first()

    if not user or not user.email_verification_expires_at:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş doğrulama bağlantısı")

    if datetime.utcnow() > user.email_verification_expires_at:
        raise HTTPException(status_code=400, detail="Doğrulama bağlantısının süresi dolmuş")

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    await db.commit()
    return success_response(data={}, message="E-posta başarıyla doğrulandı")


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.email_verified:
        return success_response(data={}, message="E-posta zaten doğrulanmış")

    raw_token, hashed_token, expires_at = _generate_verification_token()
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    user.email_verification_token = hashed_token
    user.email_verification_expires_at = expires_at
    await db.commit()

    try:
        from app.core.email import send_verification_email
        await send_verification_email(user.email, raw_token)
    except Exception:
        pass

    return success_response(data={}, message="Doğrulama e-postası yeniden gönderildi")


# ── GS-011: Şifre sıfırlama ───────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()

    # E-posta numaralandırmasını önlemek için her durumda 200 dön
    if user:
        raw_token, hashed_token, expires_at = _generate_reset_token()
        user.password_reset_token = hashed_token
        user.password_reset_expires_at = expires_at
        await db.commit()
        try:
            from app.core.email import send_password_reset_email
            await send_password_reset_email(user.email, raw_token)
        except Exception:
            pass

    return success_response(
        data={},
        message="Şifre sıfırlama bağlantısı e-posta adresinize gönderildi (kayıtlıysa)",
    )


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Şifre en az 8 karakter olmalıdır")

    hashed = _hash_token(body.token)
    result = await db.execute(
        select(User).where(User.password_reset_token == hashed)
    )
    user = result.scalars().first()

    if not user or not user.password_reset_expires_at:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş sıfırlama bağlantısı")

    if datetime.utcnow() > user.password_reset_expires_at:
        user.password_reset_token = None
        user.password_reset_expires_at = None
        await db.commit()
        raise HTTPException(status_code=400, detail="Sıfırlama bağlantısının süresi dolmuş")

    user.password_hash = hash_password(body.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    # Aktif oturumları geçersiz kıl
    user.refresh_token = None
    user.refresh_token_expires_at = None
    await db.commit()
    return success_response(data={}, message="Şifre başarıyla sıfırlandı")


# ── GS-013: Kullanıcı rol yönetimi (admin) ────────────────────────────────────

@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    body: RoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    if body.role not in _VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz rol '{body.role}'. İzin verilenler: {sorted(_VALID_ROLES)}",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    user.role = body.role
    await db.commit()
    return success_response(
        data={"user_id": user_id, "role": body.role},
        message="Kullanıcı rolü güncellendi",
    )


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return success_response(
        data=[UserResponse.model_validate(u).model_dump() for u in users],
        message=f"{len(users)} kullanıcı listelendi",
    )
