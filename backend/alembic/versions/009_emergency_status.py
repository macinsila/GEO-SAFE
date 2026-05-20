"""Add status field to emergency_reports

Revision ID: 009_emergency_status
Revises: 008_volunteer_and_shelter_intake
Create Date: 2026-05-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "009_emergency_status"
down_revision = "008_volunteer_and_shelter_intake"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "emergency_reports" not in table_names:
        op.create_table(
            "emergency_reports",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("durum", sa.String(), nullable=False),
            sa.Column("saat", sa.String(), nullable=False),
            sa.Column("harita_link", sa.String(), nullable=True),
            sa.Column("enlem", sa.Float(), nullable=False),
            sa.Column("boylam", sa.Float(), nullable=False),
            sa.Column(
                "status",
                sa.String(length=50),
                nullable=False,
                server_default="new",
            ),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        return

    column_names = {column["name"] for column in inspector.get_columns("emergency_reports")}
    if "status" not in column_names:
        op.add_column(
            "emergency_reports",
            sa.Column(
                "status",
                sa.String(length=50),
                nullable=False,
                server_default="new",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "emergency_reports" not in table_names:
        return

    column_names = {column["name"] for column in inspector.get_columns("emergency_reports")}
    if "status" in column_names:
        op.drop_column("emergency_reports", "status")
