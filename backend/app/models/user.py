"""
User Model
Represents system users (admins, operators, volunteers).
"""

from sqlalchemy import Column, DateTime, Integer, JSON, String
from sqlalchemy.sql import func

from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    role = Column(String(50), default="operator", comment="admin, operator, viewer")
    password_hash = Column(String(255), nullable=True)
    data = Column(JSON, nullable=True)

    # Refresh token support (GS-010)
    refresh_token = Column(String(512), nullable=True)
    refresh_token_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"
