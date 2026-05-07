"""Convert location columns to PostGIS geometry points

Revision ID: 002_geometry_point_columns
Revises: 001_initial
Create Date: 2026-04-23 12:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "002_geometry_point_columns"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # Convert warehouses.location from text/varchar to geometry(Point,4326) if needed.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'warehouses'
                  AND column_name = 'location'
                  AND udt_name IN ('varchar', 'text')
            ) THEN
                ALTER TABLE warehouses
                ALTER COLUMN location TYPE geometry(Point,4326)
                USING CASE
                    WHEN location IS NULL OR btrim(location) = '' THEN NULL
                    WHEN location ILIKE 'POINT(%' THEN ST_GeomFromText(location, 4326)
                    WHEN location LIKE '{%' THEN ST_SetSRID(ST_GeomFromGeoJSON(location), 4326)
                    ELSE NULL
                END;
            END IF;
        END
        $$;
        """
    )

    # Backfill warehouses.location from warehouses.data.location where possible.
    op.execute(
        """
        UPDATE warehouses
        SET location = ST_SetSRID(
            ST_MakePoint(
                (data->'location'->>'lon')::double precision,
                (data->'location'->>'lat')::double precision
            ),
            4326
        )
        WHERE location IS NULL
          AND data IS NOT NULL
          AND data->'location' IS NOT NULL
          AND data->'location'->>'lon' IS NOT NULL
          AND data->'location'->>'lat' IS NOT NULL;
        """
    )

    # Add SafeZone.location as geometry(Point,4326).
    op.execute(
        """
        ALTER TABLE safe_zones
        ADD COLUMN IF NOT EXISTS location geometry(Point,4326);
        """
    )

    # Backfill SafeZone.location using bounds centroid from JSON metadata.
    op.execute(
        """
        UPDATE safe_zones
        SET location = ST_SetSRID(
            ST_MakePoint(
                ((data->'bounds'->>'minLon')::double precision + (data->'bounds'->>'maxLon')::double precision) / 2.0,
                ((data->'bounds'->>'minLat')::double precision + (data->'bounds'->>'maxLat')::double precision) / 2.0
            ),
            4326
        )
        WHERE location IS NULL
          AND data IS NOT NULL
          AND data->'bounds' IS NOT NULL
          AND data->'bounds'->>'minLon' IS NOT NULL
          AND data->'bounds'->>'maxLon' IS NOT NULL
          AND data->'bounds'->>'minLat' IS NOT NULL
          AND data->'bounds'->>'maxLat' IS NOT NULL;
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS warehouses_loc_gist ON warehouses USING GIST(location)")
    op.execute("CREATE INDEX IF NOT EXISTS safe_zones_loc_gist ON safe_zones USING GIST(location)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS safe_zones_loc_gist")
    op.execute("DROP INDEX IF EXISTS warehouses_loc_gist")

    op.execute("ALTER TABLE safe_zones DROP COLUMN IF EXISTS location")

    # Convert warehouses.location back to varchar for downgrade compatibility.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'warehouses'
                  AND column_name = 'location'
                  AND udt_name = 'geometry'
            ) THEN
                ALTER TABLE warehouses
                ALTER COLUMN location TYPE varchar
                USING ST_AsText(location);
            END IF;
        END
        $$;
        """
    )
