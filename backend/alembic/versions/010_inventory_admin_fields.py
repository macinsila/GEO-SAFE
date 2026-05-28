"""Add inventory admin item fields

Revision ID: 010_inventory_admin_fields
Revises: 009_emergency_status
Create Date: 2026-05-16 08:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "010_inventory_admin_fields"
down_revision = "009_emergency_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "items" not in table_names:
        return

    column_names = {column["name"] for column in inspector.get_columns("items")}

    if "low_stock_threshold" not in column_names:
        op.add_column(
            "items",
            sa.Column("low_stock_threshold", sa.Integer(), nullable=True),
        )
    if "is_active" not in column_names:
        op.add_column(
            "items",
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )
    if "updated_at" not in column_names:
        op.add_column(
            "items",
            sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "items" not in table_names:
        return

    column_names = {column["name"] for column in inspector.get_columns("items")}

    if "updated_at" in column_names:
        op.drop_column("items", "updated_at")
    if "is_active" in column_names:
        op.drop_column("items", "is_active")
    if "low_stock_threshold" in column_names:
        op.drop_column("items", "low_stock_threshold")
