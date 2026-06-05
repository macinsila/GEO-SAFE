"""Add chat_read_receipts table (GS-112)

Tracks each user's last-read position per room so the frontend can show
an unread-messages badge.

Revision ID: 030_chat_read_receipts
Revises: 029_volunteer_skill_matching
Create Date: 2026-06-06 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "030_chat_read_receipts"
down_revision = "029_volunteer_skill_matching"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "chat_read_receipts" not in tables:
        op.create_table(
            "chat_read_receipts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("room", sa.String(length=50), nullable=False),
            sa.Column("last_read_message_id", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "room", name="uq_chat_read_user_room"),
        )
        op.create_index(
            "ix_chat_read_receipts_user_room",
            "chat_read_receipts",
            ["user_id", "room"],
        )


def downgrade() -> None:
    op.drop_index("ix_chat_read_receipts_user_room", table_name="chat_read_receipts")
    op.drop_table("chat_read_receipts")
