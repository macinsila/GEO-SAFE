"""Align inventory_movements data column

Revision ID: 006_inventory_movements_data_column
Revises: 005_users_data_column
Create Date: 2026-05-06 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "006_inventory_movements_data_column"
down_revision = "005_users_data_column"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'inventory_movements'
                  AND column_name = 'metadata'
            ) AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'inventory_movements'
                  AND column_name = 'data'
            ) THEN
                ALTER TABLE inventory_movements RENAME COLUMN metadata TO data;
            ELSIF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'inventory_movements'
                  AND column_name = 'data'
            ) THEN
                ALTER TABLE inventory_movements ADD COLUMN data JSONB;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'inventory_movements'
                  AND column_name = 'data'
            ) AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'inventory_movements'
                  AND column_name = 'metadata'
            ) THEN
                ALTER TABLE inventory_movements RENAME COLUMN data TO metadata;
            ELSIF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'inventory_movements'
                  AND column_name = 'data'
            ) THEN
                ALTER TABLE inventory_movements DROP COLUMN data;
            END IF;
        END
        $$;
        """
    )
