"""Create emergency reports table

Revision ID: 004_emergency_reports
Revises: 003_safe_zone_geometry_fix
Create Date: 2026-05-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "004_emergency_reports"
down_revision = "003_safe_zone_geometry_fix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "emergency_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("durum", sa.String(), nullable=False),
        sa.Column("saat", sa.String(), nullable=False),
        sa.Column("harita_link", sa.String(), nullable=True),
        sa.Column("enlem", sa.Float(), nullable=False),
        sa.Column("boylam", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("emergency_reports")
