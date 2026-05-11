"""Add users.data column

Revision ID: 005_users_data_column
Revises: 004_emergency_reports
Create Date: 2026-05-06 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "005_users_data_column"
down_revision = "004_emergency_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS data JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS data")
