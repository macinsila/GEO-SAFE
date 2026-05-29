"""GS-013 — RBAC: users.role varsayılanı citizen olarak güncellendi

Revision ID: 018_rbac_role_default
Revises: 017_push_subscriptions
Create Date: 2026-05-28 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text

revision = "018_rbac_role_default"
down_revision = "017_push_subscriptions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("users")}
    if "role" not in cols:
        return

    # Yeni kayıtlar için varsayılanı citizen yap
    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(50),
        server_default="citizen",
        existing_nullable=True,
    )

    # "viewer" rolündeki mevcut kullanıcıları citizen'a taşı
    op.execute(text("UPDATE users SET role = 'citizen' WHERE role = 'viewer'"))


def downgrade() -> None:
    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(50),
        server_default="operator",
        existing_nullable=True,
    )
    op.execute(text("UPDATE users SET role = 'operator' WHERE role = 'citizen'"))
