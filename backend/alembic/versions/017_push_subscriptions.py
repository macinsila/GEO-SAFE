"""Add push_subscriptions table

Revision ID: 017_push_subscriptions
Revises: 016_zone_needs
Create Date: 2026-05-28 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "017_push_subscriptions"
down_revision = "016_zone_needs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "push_subscriptions" in set(inspector.get_table_names()):
        return

    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("keys", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
    op.create_index("ix_push_subscriptions_endpoint", "push_subscriptions", ["endpoint"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "push_subscriptions" in set(inspector.get_table_names()):
        op.drop_index("ix_push_subscriptions_endpoint", "push_subscriptions")
        op.drop_index("ix_push_subscriptions_user_id", "push_subscriptions")
        op.drop_table("push_subscriptions")
