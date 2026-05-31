"""Add image_url to emergency_reports

Revision ID: 024_emergency_image_url
Revises: 023_volunteer_tasks
Create Date: 2026-05-31 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "024_emergency_image_url"
down_revision = "023_volunteer_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("emergency_reports")}
    if "image_url" not in cols:
        op.add_column(
            "emergency_reports",
            sa.Column("image_url", sa.String(length=500), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("emergency_reports")}
    if "image_url" in cols:
        op.drop_column("emergency_reports", "image_url")
