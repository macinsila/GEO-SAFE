"""
GS-014 — Audit log helper.

Her önemli mutasyon işleminden sonra çağrılır; kim, ne, ne zaman değiştirdi
bilgisini audit_logs tablosuna yazar.
"""

import logging
from typing import Any, Optional, Union

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import request_id_var
from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


async def log_audit(
    db: AsyncSession,
    action: str,
    resource_type: str,
    resource_id: Optional[Union[str, int]] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    actor: Optional[User] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Write an audit entry into the current DB session (non-fatal on error)."""
    try:
        entry = AuditLog(
            user_id=actor.id if actor else None,
            user_email=actor.email if actor else None,
            user_role=actor.role if actor else None,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            old_value=old_value,
            new_value=new_value,
            request_id=request_id_var.get("") or None,
            ip_address=ip_address,
        )
        db.add(entry)
    except Exception:
        logger.exception("Audit log yazılamadı (non-fatal)")
