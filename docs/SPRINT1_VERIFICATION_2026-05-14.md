# Sprint 1 Verification - 2026-05-14

Environment: Windows PowerShell, Europe/Istanbul.

## Docker/PostGIS

```powershell
$env:JWT_SECRET="sprint1-verification-secret-2026-05-14-32chars"
docker compose up -d db
```

Result: passed.

Key output:

```text
Container geosafe_db Starting
Container geosafe_db Started
geosafe_db   Up 5 minutes (healthy)   0.0.0.0:5432->5432/tcp
```

Note: the obsolete Docker Compose `version` field was removed after verification; `docker compose ps db`
now reports the healthy container without that warning.

## Alembic

```powershell
cd backend
alembic -c alembic/alembic.ini upgrade head
```

Result: passed. The command completed with exit code 0.

## Application DB Repair And Schema Checks

Reviewer follow-up found that an earlier backend test run had used `geosafe_db`
as `TEST_DATABASE_URL`, leaving `alembic_version` at head while application tables
were gone. The app DB was repaired by restamping the empty schema to base and
running migrations again:

```powershell
$env:DATABASE_URL="postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe_db"
cd backend
alembic -c alembic/alembic.ini stamp base
alembic -c alembic/alembic.ini upgrade head
```

Result: passed.

Post-migration checks:

```text
alembic_version: 007_inventory_quantity_non_negative
tables: emergency_reports, inventory_movements, safe_zones, users, warehouse_inventory, warehouses
constraint: ck_warehouse_inventory_quantity_non_negative
```

## Backend Tests

```powershell
docker exec geosafe_db psql -U geosafe_user -d postgres -c "CREATE DATABASE geosafe_test_db"
$env:TEST_DATABASE_URL="postgresql://geosafe_user:geosafe_pass@localhost:5432/geosafe_test_db"
pytest backend/tests
```

Result: passed.

Key output:

```text
collected 25 items
backend\tests\test_auth_roles.py ....                                    [ 16%]
backend\tests\test_emergency.py ....                                     [ 32%]
backend\tests\test_inventory.py .....                                    [ 52%]
backend\tests\test_safe_zones.py ..                                      [ 60%]
backend\tests\test_spatial.py .....                                      [ 80%]
backend\tests\test_warehouses.py .....                                   [100%]
25 passed, 8 warnings in 5.16s
```

## Test DB Guard

Test DB guard check:

```powershell
$env:TEST_DATABASE_URL="postgresql://geosafe_user:geosafe_pass@localhost:5432/geosafe_db"
pytest backend/tests -q
```

Result: expected failure before DB mutation.

Key output:

```text
RuntimeError: Refusing to run backend tests because TEST_DATABASE_URL does not look like a test database. Use a dedicated database name such as geosafe_test_db.
```

After the `geosafe_test_db` test run, the application DB still had:

```text
alembic_version: 007_inventory_quantity_non_negative
tables: emergency_reports, inventory_movements, safe_zones, users, warehouse_inventory, warehouses
constraint: ck_warehouse_inventory_quantity_non_negative
```

## Frontend Tests

```powershell
npm test
```

Result: passed.

Key output:

```text
react-scripts test --passWithNoTests --watchAll=false
No tests found, exiting with code 0
```

## Frontend Build

```powershell
npm run build
```

Result: passed.

Key output:

```text
Creating an optimized production build...
Compiled successfully.
124.96 kB  build\static\js\main.6895e627.js
7.46 kB    build\static\css\main.a8b870e2.css
```
