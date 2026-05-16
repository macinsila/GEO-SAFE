"""Add volunteer applications and shelter offers

Revision ID: 008_volunteer_and_shelter_intake
Revises: 007_inventory_quantity_non_negative
Create Date: 2026-05-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "008_volunteer_and_shelter_intake"
down_revision = "007_inventory_quantity_non_negative"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "volunteer_applications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("contact_info", sa.String(length=255), nullable=False),
        sa.Column("district", sa.String(length=255), nullable=True),
        sa.Column("neighborhood", sa.String(length=255), nullable=True),
        sa.Column("skills", sa.JSON, nullable=True),
        sa.Column("availability_note", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    op.create_table(
        "shelter_offers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("host_name", sa.String(length=255), nullable=False),
        sa.Column("contact_info", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("district", sa.String(length=255), nullable=True),
        sa.Column("neighborhood", sa.String(length=255), nullable=True),
        sa.Column("address_detail", sa.String(length=1000), nullable=True),
        sa.Column("capacity", sa.Integer, nullable=False),
        sa.Column("available_from", sa.Date, nullable=True),
        sa.Column("available_until", sa.Date, nullable=True),
        sa.Column("duration_note", sa.String(length=500), nullable=True),
        sa.Column("household_notes", sa.String(length=500), nullable=True),
        sa.Column("suitability_notes", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("shelter_offers")
    op.drop_table("volunteer_applications")
