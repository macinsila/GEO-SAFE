"""Add quiet_hours and critical_override_magnitude to earthquake_notification_prefs (GS-102)

Revision ID: 026_quiet_hours
Revises: 025_chat_messages
Create Date: 2026-06-04 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "026_quiet_hours"
down_revision = "025_chat_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("earthquake_notification_prefs")}

    if "quiet_hours_start" not in existing_cols:
        op.add_column(
            "earthquake_notification_prefs",
            sa.Column("quiet_hours_start", sa.Integer(), nullable=True),
        )
    if "quiet_hours_end" not in existing_cols:
        op.add_column(
            "earthquake_notification_prefs",
            sa.Column("quiet_hours_end", sa.Integer(), nullable=True),
        )
    if "critical_override_magnitude" not in existing_cols:
        op.add_column(
            "earthquake_notification_prefs",
            sa.Column("critical_override_magnitude", sa.Float(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("earthquake_notification_prefs", "critical_override_magnitude")
    op.drop_column("earthquake_notification_prefs", "quiet_hours_end")
    op.drop_column("earthquake_notification_prefs", "quiet_hours_start")
