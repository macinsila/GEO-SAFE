"""Add refresh token columns to users

Revision ID: 013_refresh_tokens
Revises: 012_announcements
Create Date: 2026-05-28 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "013_refresh_tokens"
down_revision = "012_announcements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("users")}

    if "refresh_token" not in column_names:
        op.add_column("users", sa.Column("refresh_token", sa.String(512), nullable=True))
    if "refresh_token_expires_at" not in column_names:
        op.add_column(
            "users",
            sa.Column("refresh_token_expires_at", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("users")}

    if "refresh_token_expires_at" in column_names:
        op.drop_column("users", "refresh_token_expires_at")
    if "refresh_token" in column_names:
        op.drop_column("users", "refresh_token")
