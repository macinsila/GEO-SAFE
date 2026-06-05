"""Add neighborhood chat channels + moderation (GS-111)

Creates chat_channels, chat_channel_memberships, chat_message_reports and adds
chat_messages.is_removed for soft-delete moderation.

Revision ID: 028_chat_channels
Revises: 027_geofence_subscriptions
Create Date: 2026-06-05 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "028_chat_channels"
down_revision = "027_geofence_subscriptions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "chat_channels" not in tables:
        op.create_table(
            "chat_channels",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("slug", sa.String(length=50), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("center_lat", sa.Float(), nullable=True),
            sa.Column("center_lon", sa.Float(), nullable=True),
            sa.Column("radius_km", sa.Float(), nullable=False, server_default="5.0"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index(
            "ix_chat_channels_slug", "chat_channels", ["slug"], unique=True
        )

    if "chat_channel_memberships" not in tables:
        op.create_table(
            "chat_channel_memberships",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "channel_id",
                sa.Integer(),
                sa.ForeignKey("chat_channels.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("muted", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("joined_at", sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint("channel_id", "user_id", name="uq_channel_membership"),
        )

    if "chat_message_reports" not in tables:
        op.create_table(
            "chat_message_reports",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "message_id",
                sa.Integer(),
                sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("reporter_user_id", sa.Integer(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )

    existing_cols = {c["name"] for c in inspector.get_columns("chat_messages")}
    if "is_removed" not in existing_cols:
        op.add_column(
            "chat_messages",
            sa.Column(
                "is_removed",
                sa.Boolean(),
                nullable=False,
                server_default="false",
            ),
        )


def downgrade() -> None:
    op.drop_column("chat_messages", "is_removed")
    op.drop_table("chat_message_reports")
    op.drop_table("chat_channel_memberships")
    op.drop_index("ix_chat_channels_slug", table_name="chat_channels")
    op.drop_table("chat_channels")
