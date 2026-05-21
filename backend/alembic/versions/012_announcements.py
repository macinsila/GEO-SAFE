"""Add announcements table

Revision ID: 012_announcements
Revises: 011_emergency_kategori_aciklama
Create Date: 2026-05-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "012_announcements"
down_revision = "011_emergency_kategori_aciklama"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "announcements" in table_names:
        return

    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("kategori", sa.String(length=100), nullable=True),
        sa.Column(
            "priority",
            sa.String(length=20),
            nullable=False,
            server_default="normal",
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "announcements" in set(inspector.get_table_names()):
        op.drop_table("announcements")
