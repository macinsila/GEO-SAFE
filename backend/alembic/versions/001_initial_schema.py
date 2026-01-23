"""Initial schema setup with PostGIS tables

Revision ID: 001_initial
Revises: 
Create Date: 2025-12-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


# revision identifiers, used by Alembic
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), server_default='operator'),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    
    # Create items table
    op.create_table(
        'items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sku', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('unit', sa.String(50), server_default='unit'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sku'),
    )
    
    # Create safe_zones table (with PostGIS Polygon geometry)
    op.create_table(
        'safe_zones',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('geometry', Geometry(geometry_type='Polygon', srid=4326), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('capacity_type', sa.String(50), server_default='persons'),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    # Create spatial index on geometry
    op.execute('CREATE INDEX safe_zones_geom_gist ON safe_zones USING GIST(geometry)')
    
    # Create warehouses table (with PostGIS Point geometry)
    op.create_table(
        'warehouses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('location', Geometry(geometry_type='Point', srid=4326), nullable=False),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    # Create spatial index on location
    op.execute('CREATE INDEX warehouses_loc_gist ON warehouses USING GIST(location)')
    
    # Create warehouse_inventory table
    op.create_table(
        'warehouse_inventory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default='0'),
        sa.Column('last_updated', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
    )
    
    # Create inventory_movements table
    op.create_table(
        'inventory_movements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('from_warehouse_id', sa.Integer(), nullable=True),
        sa.Column('to_warehouse_id', sa.Integer(), nullable=True),
        sa.Column('movement_type', sa.String(50), nullable=False),
        sa.Column('performed_by', sa.Integer(), nullable=True),
        sa.Column('note', sa.String(500), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
        sa.ForeignKeyConstraint(['from_warehouse_id'], ['warehouses.id'], ),
        sa.ForeignKeyConstraint(['to_warehouse_id'], ['warehouses.id'], ),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id'], ),
    )


def downgrade() -> None:
    op.drop_table('inventory_movements')
    op.drop_table('warehouse_inventory')
    op.drop_index('warehouses_loc_gist')
    op.drop_table('warehouses')
    op.drop_index('safe_zones_geom_gist')
    op.drop_table('safe_zones')
    op.drop_table('items')
    op.drop_table('users')
    op.execute('DROP EXTENSION IF EXISTS postgis')
