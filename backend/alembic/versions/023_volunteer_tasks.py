"""Add volunteer_tasks table

Revision ID: 023_volunteer_tasks
Revises: 022_earthquake_notifications_sent
Create Date: 2026-05-31 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "023_volunteer_tasks"
down_revision = "022_earthquake_notifications_sent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "volunteer_tasks" in set(inspector.get_table_names()):
        return

    op.create_table(
        "volunteer_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("skill_required", sa.String(length=100), nullable=True),
        sa.Column("urgency", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("assigned_to_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_volunteer_tasks_status", "volunteer_tasks", ["status"])
    op.create_index("ix_volunteer_tasks_assigned_to_id", "volunteer_tasks", ["assigned_to_id"])
    op.create_index("ix_volunteer_tasks_created_by_id", "volunteer_tasks", ["created_by_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "volunteer_tasks" in set(inspector.get_table_names()):
        op.drop_index("ix_volunteer_tasks_created_by_id", "volunteer_tasks")
        op.drop_index("ix_volunteer_tasks_assigned_to_id", "volunteer_tasks")
        op.drop_index("ix_volunteer_tasks_status", "volunteer_tasks")
        op.drop_table("volunteer_tasks")
