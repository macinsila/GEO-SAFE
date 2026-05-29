"""GS-011 — users tablosuna e-posta doğrulama ve şifre sıfırlama kolonları

Revision ID: 020_user_auth_extras
Revises: 019_audit_log
Create Date: 2026-05-28 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "020_user_auth_extras"
down_revision = "019_audit_log"
branch_labels = None
depends_on = None

_NEW_COLS = [
    "email_verified",
    "email_verification_token",
    "email_verification_expires_at",
    "password_reset_token",
    "password_reset_expires_at",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("users")}

    if "email_verified" not in existing:
        op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"))
    if "email_verification_token" not in existing:
        op.add_column("users", sa.Column("email_verification_token", sa.String(255), nullable=True))
    if "email_verification_expires_at" not in existing:
        op.add_column("users", sa.Column("email_verification_expires_at", sa.DateTime(), nullable=True))
    if "password_reset_token" not in existing:
        op.add_column("users", sa.Column("password_reset_token", sa.String(255), nullable=True))
    if "password_reset_expires_at" not in existing:
        op.add_column("users", sa.Column("password_reset_expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("users")}
    for col in _NEW_COLS:
        if col in existing:
            op.drop_column("users", col)
