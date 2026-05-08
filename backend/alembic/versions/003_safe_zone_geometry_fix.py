"""Fix safe_zones.geometry to PostGIS polygon

Revision ID: 003_safe_zone_geometry_fix
Revises: 002_geometry_point_columns
Create Date: 2026-05-06 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "003_safe_zone_geometry_fix"
down_revision = "002_geometry_point_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.execute(
        """
        ALTER TABLE safe_zones
        ADD COLUMN IF NOT EXISTS geometry geometry(Polygon,4326);
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'safe_zones'
                  AND column_name = 'geometry'
                  AND udt_name IN ('varchar', 'text')
            ) THEN
                ALTER TABLE safe_zones
                ALTER COLUMN geometry TYPE geometry(Polygon,4326)
                USING CASE
                    WHEN geometry IS NULL OR btrim(geometry) = '' THEN NULL
                    WHEN geometry ILIKE 'POLYGON(%' THEN ST_GeomFromText(geometry, 4326)
                    WHEN geometry LIKE '{%' THEN ST_SetSRID(ST_GeomFromGeoJSON(geometry), 4326)
                    ELSE NULL
                END;
            END IF;
        END
        $$;
        """
    )

    op.execute(
        """
        UPDATE safe_zones
        SET geometry = ST_MakeEnvelope(
            (data->'bounds'->>'minLon')::double precision,
            (data->'bounds'->>'minLat')::double precision,
            (data->'bounds'->>'maxLon')::double precision,
            (data->'bounds'->>'maxLat')::double precision,
            4326
        )
        WHERE geometry IS NULL
          AND data IS NOT NULL
          AND data->'bounds' IS NOT NULL
          AND data->'bounds'->>'minLon' IS NOT NULL
          AND data->'bounds'->>'maxLon' IS NOT NULL
          AND data->'bounds'->>'minLat' IS NOT NULL
          AND data->'bounds'->>'maxLat' IS NOT NULL;
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS safe_zones_geom_gist ON safe_zones USING GIST(geometry)")


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'safe_zones'
                  AND column_name = 'geometry'
                  AND udt_name = 'geometry'
            ) THEN
                ALTER TABLE safe_zones
                ALTER COLUMN geometry TYPE varchar
                USING ST_AsText(geometry);
            END IF;
        END
        $$;
        """
    )
