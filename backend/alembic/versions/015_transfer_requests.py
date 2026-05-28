"""Add transfer_requests table

Revision ID: 015_transfer_requests
Revises: 014_safe_checkin
Create Date: 2026-05-28 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "015_transfer_requests"
down_revision = "014_safe_checkin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "transfer_requests" in set(inspector.get_table_names()):
        return

    op.create_table(
        "transfer_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("from_warehouse_id", sa.Integer(), nullable=False),
        sa.Column("to_warehouse_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("requested_by", sa.Integer(), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        # pending → approved → completed | rejected
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transfer_requests_status", "transfer_requests", ["status"])
    op.create_index("ix_transfer_requests_from", "transfer_requests", ["from_warehouse_id"])
    op.create_index("ix_transfer_requests_to", "transfer_requests", ["to_warehouse_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "transfer_requests" in set(inspector.get_table_names()):
        op.drop_index("ix_transfer_requests_to", "transfer_requests")
        op.drop_index("ix_transfer_requests_from", "transfer_requests")
        op.drop_index("ix_transfer_requests_status", "transfer_requests")
        op.drop_table("transfer_requests")
