"""Add zone_needs table

Revision ID: 016_zone_needs
Revises: 015_transfer_requests
Create Date: 2026-05-28 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "016_zone_needs"
down_revision = "015_transfer_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "zone_needs" in set(inspector.get_table_names()):
        return

    op.create_table(
        "zone_needs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("safe_zone_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=True),   # None = free-text item
        sa.Column("item_name_free", sa.String(255), nullable=True),  # free-text fallback
        sa.Column("quantity_needed", sa.Integer(), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("reported_by", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="open"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_zone_needs_safe_zone_id", "zone_needs", ["safe_zone_id"])
    op.create_index("ix_zone_needs_status", "zone_needs", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "zone_needs" in set(inspector.get_table_names()):
        op.drop_index("ix_zone_needs_status", "zone_needs")
        op.drop_index("ix_zone_needs_safe_zone_id", "zone_needs")
        op.drop_table("zone_needs")
