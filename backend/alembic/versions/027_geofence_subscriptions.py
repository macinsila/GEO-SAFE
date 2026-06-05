"""Add geofence_subscriptions table (GS-023 geofenced incident alerts)

Revision ID: 027_geofence_subscriptions
Revises: 026_quiet_hours
Create Date: 2026-06-05 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "027_geofence_subscriptions"
down_revision = "026_quiet_hours"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "geofence_subscriptions" in inspector.get_table_names():
        return

    op.create_table(
        "geofence_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("center_lat", sa.Float(), nullable=True),
        sa.Column("center_lon", sa.Float(), nullable=True),
        sa.Column("radius_km", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_geofence_subscriptions_user_id",
        "geofence_subscriptions",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_geofence_subscriptions_user_id", table_name="geofence_subscriptions")
    op.drop_table("geofence_subscriptions")
