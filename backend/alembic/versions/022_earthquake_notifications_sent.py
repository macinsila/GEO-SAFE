"""Add earthquake_notifications_sent table

Revision ID: 022_earthquake_notifications_sent
Revises: 021_earthquake_notification_prefs
Create Date: 2026-05-29 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "022_earthquake_notifications_sent"
down_revision = "021_earthquake_notification_prefs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "earthquake_notifications_sent" in set(inspector.get_table_names()):
        return

    op.create_table(
        "earthquake_notifications_sent",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("eq_key", sa.String(length=255), nullable=False),
        sa.Column("sent_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "eq_key", name="uq_eq_notif_sent_user_key"),
    )
    op.create_index(
        "ix_earthquake_notifications_sent_user_id",
        "earthquake_notifications_sent",
        ["user_id"],
    )
    op.create_index(
        "ix_earthquake_notifications_sent_eq_key",
        "earthquake_notifications_sent",
        ["eq_key"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "earthquake_notifications_sent" in set(inspector.get_table_names()):
        op.drop_index(
            "ix_earthquake_notifications_sent_eq_key",
            "earthquake_notifications_sent",
        )
        op.drop_index(
            "ix_earthquake_notifications_sent_user_id",
            "earthquake_notifications_sent",
        )
        op.drop_table("earthquake_notifications_sent")
