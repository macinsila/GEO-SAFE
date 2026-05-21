"""Add kategori and aciklama fields to emergency_reports

Revision ID: 011_emergency_kategori_aciklama
Revises: 010_inventory_admin_fields
Create Date: 2026-05-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "011_emergency_kategori_aciklama"
down_revision = "010_inventory_admin_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "emergency_reports" not in table_names:
        return

    column_names = {col["name"] for col in inspector.get_columns("emergency_reports")}

    if "kategori" not in column_names:
        op.add_column(
            "emergency_reports",
            sa.Column("kategori", sa.String(100), nullable=True),
        )

    if "aciklama" not in column_names:
        op.add_column(
            "emergency_reports",
            sa.Column("aciklama", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "emergency_reports" not in table_names:
        return

    column_names = {col["name"] for col in inspector.get_columns("emergency_reports")}

    if "aciklama" in column_names:
        op.drop_column("emergency_reports", "aciklama")

    if "kategori" in column_names:
        op.drop_column("emergency_reports", "kategori")
