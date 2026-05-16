"""Add inventory admin item fields

Revision ID: 010_inventory_admin_fields
Revises: 009_emergency_status
Create Date: 2026-05-16 08:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "010_inventory_admin_fields"
down_revision = "009_emergency_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column("low_stock_threshold", sa.Integer(), nullable=True),
    )
    op.add_column(
        "items",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "items",
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_column("items", "updated_at")
    op.drop_column("items", "is_active")
    op.drop_column("items", "low_stock_threshold")
