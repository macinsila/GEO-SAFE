"""Add safe_checkins table

Revision ID: 014_safe_checkin
Revises: 013_refresh_tokens
Create Date: 2026-05-28 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "014_safe_checkin"
down_revision = "013_refresh_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "safe_checkins" in set(inspector.get_table_names()):
        return

    op.create_table(
        "safe_checkins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),   # nullable = allows anonymous offline sync
        sa.Column("name", sa.String(255), nullable=True),    # display name (offline/anonymous path)
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="online"),  # online | offline_sync
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_safe_checkins_user_id", "safe_checkins", ["user_id"])
    op.create_index("ix_safe_checkins_created_at", "safe_checkins", ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "safe_checkins" in set(inspector.get_table_names()):
        op.drop_index("ix_safe_checkins_created_at", "safe_checkins")
        op.drop_index("ix_safe_checkins_user_id", "safe_checkins")
        op.drop_table("safe_checkins")
