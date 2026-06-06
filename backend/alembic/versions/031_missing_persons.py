"""Add missing_persons table (GS-041)

Kayıp kişi / yeniden birleşme panosu. Kesin konum saklanmaz (gizlilik);
sadece mahalle/ilçe adı tutulur.

Revision ID: 031_missing_persons
Revises: 030_chat_read_receipts
Create Date: 2026-06-06 00:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "031_missing_persons"
down_revision = "030_chat_read_receipts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "missing_persons" not in tables:
        op.create_table(
            "missing_persons",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("age", sa.Integer(), nullable=True),
            sa.Column("last_seen_district", sa.String(length=200), nullable=False),
            sa.Column("last_seen_description", sa.Text(), nullable=True),
            sa.Column("photo_url", sa.String(length=500), nullable=True),
            sa.Column("contact_info", sa.String(length=500), nullable=True),
            sa.Column(
                "reported_by_user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index(
            "ix_missing_persons_status",
            "missing_persons",
            ["status"],
        )
        op.create_index(
            "ix_missing_persons_last_seen_district",
            "missing_persons",
            ["last_seen_district"],
        )


def downgrade() -> None:
    op.drop_index("ix_missing_persons_last_seen_district", table_name="missing_persons")
    op.drop_index("ix_missing_persons_status", table_name="missing_persons")
    op.drop_table("missing_persons")
