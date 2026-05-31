"""Create chat_messages table (GS-110)

Revision ID: 025_chat_messages
Revises: 024_emergency_image_url
Create Date: 2026-05-31 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "025_chat_messages"
down_revision = "024_emergency_image_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("user_name", sa.String(255), nullable=False),
        sa.Column("room", sa.String(50), nullable=False, server_default="ops"),
        sa.Column("body", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_chat_messages_room_created",
        "chat_messages",
        ["room", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_room_created", table_name="chat_messages")
    op.drop_table("chat_messages")
