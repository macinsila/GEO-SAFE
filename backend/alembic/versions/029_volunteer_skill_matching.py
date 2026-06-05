"""Add primary_role to volunteer_applications (GS-051)

Revision ID: 029_volunteer_skill_matching
Revises: 028_chat_channels
Create Date: 2026-06-05 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "029_volunteer_skill_matching"
down_revision = "028_chat_channels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("volunteer_applications")}

    if "primary_role" not in columns:
        op.add_column(
            "volunteer_applications",
            sa.Column("primary_role", sa.String(50), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("volunteer_applications")}

    if "primary_role" in columns:
        op.drop_column("volunteer_applications", "primary_role")
