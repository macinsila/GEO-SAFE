#!/bin/sh
set -e

echo "Running database migrations..."
python -m alembic -c alembic/alembic.ini upgrade head

echo "Starting GeoSafe API..."
exec "$@"
