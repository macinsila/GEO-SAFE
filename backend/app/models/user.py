"""
User Model
Represents system users.

Roles (GS-013):
  citizen   — varsayılan; sadece genel okuma + kendi profili
  volunteer — gönüllü görevler
  operator  — depo/transfer/ihtiyaç yönetimi
  admin     — tam erişim
"""

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    role = Column(String(50), default="citizen", comment="citizen, volunteer, operator, admin")
    password_hash = Column(String(255), nullable=True)
    data = Column(JSON, nullable=True)

    # Refresh token (GS-010)
    refresh_token = Column(String(512), nullable=True)
    refresh_token_expires_at = Column(DateTime, nullable=True)

    # E-posta doğrulama (GS-011)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String(255), nullable=True)
    email_verification_expires_at = Column(DateTime, nullable=True)

    # Şifre sıfırlama (GS-011)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"
