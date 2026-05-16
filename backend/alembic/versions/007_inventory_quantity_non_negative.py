"""Require non-negative warehouse inventory quantities

Revision ID: 007_inventory_quantity_non_negative
Revises: 006_inventory_movements_data_column
Create Date: 2026-05-13 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "007_inventory_quantity_non_negative"
down_revision = "006_inventory_movements_data_column"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE warehouse_inventory SET quantity = 0 WHERE quantity < 0")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'ck_warehouse_inventory_quantity_non_negative'
            ) THEN
                ALTER TABLE warehouse_inventory
                ADD CONSTRAINT ck_warehouse_inventory_quantity_non_negative
                CHECK (quantity >= 0);
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE warehouse_inventory
        DROP CONSTRAINT IF EXISTS ck_warehouse_inventory_quantity_non_negative;
        """
    )
