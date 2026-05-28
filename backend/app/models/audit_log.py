"""GS-014 — Audit log modeli."""

from sqlalchemy import Column, DateTime, Integer, JSON, String
from sqlalchemy.sql import func

from .base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), nullable=True)
    user_role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False)       # create | update | delete | approve | reject
    resource_type = Column(String(100), nullable=False) # warehouse | inventory | transfer | zone_need …
    resource_id = Column(String(100), nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    request_id = Column(String(36), nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
