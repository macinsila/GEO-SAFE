"""Add earthquake_notification_prefs table

Revision ID: 021_earthquake_notification_prefs
Revises: 020_user_auth_extras
Create Date: 2026-05-29 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "021_earthquake_notification_prefs"
down_revision = "020_user_auth_extras"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "earthquake_notification_prefs" in set(inspector.get_table_names()):
        return

    op.create_table(
        "earthquake_notification_prefs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("min_magnitude", sa.Float(), nullable=False, server_default="4.0"),
        sa.Column("max_depth_km", sa.Float(), nullable=True),
        sa.Column("reference_lat", sa.Float(), nullable=True),
        sa.Column("reference_lon", sa.Float(), nullable=True),
        sa.Column("radius_km", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_earthquake_notification_prefs_user_id",
        "earthquake_notification_prefs",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "earthquake_notification_prefs" in set(inspector.get_table_names()):
        op.drop_index(
            "ix_earthquake_notification_prefs_user_id",
            "earthquake_notification_prefs",
        )
        op.drop_table("earthquake_notification_prefs")
