# GeoSafe Scripts

Utility scripts for managing the GeoSafe database and development.

## 📋 Available Scripts

### `seed_db.py` - Database Seeding

Populates PostgreSQL with realistic sample data:
- **5 Warehouses** in Istanbul neighborhoods (Beyoğlu, Fatih, Şişli, Beşiktaş, Kadıköy)
- **4 Safe Zones** (Taksim, Sultanahmet, Ortaköy, Göztepe)
- **6 Item Types** (food, water, medicine, blankets, tents, fuel)

#### Prerequisites

1. **PostgreSQL with PostGIS** running (via Docker Compose)
   ```bash
   docker-compose up -d
   ```

2. **Backend database migrations applied** (Alembic)
   ```bash
   cd backend
   alembic upgrade head
   ```

3. **Python dependencies installed**
   ```bash
   pip install -r requirements.txt
   ```

#### Usage

**From project root:**

```bash
# Using default database URL (localhost)
python scripts/seed_db.py

# Or with custom database URL
DATABASE_URL=postgresql+asyncpg://user:pass@host/db python scripts/seed_db.py

# On Windows PowerShell
$env:DATABASE_URL="postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe"
python scripts/seed_db.py
```

#### What It Does

1. ✅ Connects to PostgreSQL database
2. ✅ Enables PostGIS extension
3. ✅ Creates all tables from SQLAlchemy models
4. ✅ Seeds users, items, warehouses, and safe zones
5. ✅ Converts coordinates to PostGIS WKT format
6. ✅ Prints summary of created records

#### Sample Output

```
🌱 Starting GeoSafe Database Seeding...
📍 Database: postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe

📋 Creating tables...
   ✓ PostGIS extension enabled
   ✓ All tables created

👤 Seeding users...
   ✓ Created admin user (ID: 1)

📦 Seeding items...
   ✓ Created 6 item types

🏭 Seeding warehouses...
   ✓ Created 5 warehouses
      - Beyoğlu Supply Depot
      - Fatih Emergency Center
      - Şişli Regional Hub
      - Beşiktaş Coastal Warehouse
      - Kadıköy Distribution Center

🛡️  Seeding safe zones...
   ✓ Created 4 safe zones
      - Taksim Square Safe Zone
      - Sultanahmet Park Safe Zone
      - Ortaköy Seafront Safe Zone
      - Göztepe Sports Complex Safe Zone

✅ Database seeding completed successfully!
   - 5 Warehouses
   - 4 Safe Zones
   - 6 Item Types
```

#### Data Details

**Warehouses (Point Geometries)**

| Name | Location | Capacity | Status |
|------|----------|----------|--------|
| Beyoğlu Supply Depot | (28.9784, 41.0082) | 500 | active |
| Fatih Emergency Center | (28.9595, 41.0096) | 300 | active |
| Şişli Regional Hub | (28.9839, 41.0523) | 750 | active |
| Beşiktaş Coastal Warehouse | (29.0009, 41.0520) | 600 | active |
| Kadıköy Distribution Center | (29.0234, 40.9949) | 550 | active |

**Safe Zones (Polygon Geometries)**

| Name | Area (persons) | Type | Status |
|------|--------|------|--------|
| Taksim Square Safe Zone | 2000 | urban_square | active |
| Sultanahmet Park Safe Zone | 3000 | historic_park | active |
| Ortaköy Seafront Safe Zone | 1500 | waterfront | active |
| Göztepe Sports Complex Safe Zone | 2500 | sports_facility | active |

#### Testing After Seeding

1. **Check backend API:**
   ```bash
   curl http://localhost:8000/api/warehouses/
   curl http://localhost:8000/api/safe-zones/
   ```

2. **View in frontend:**
   ```bash
   npm start  # In frontend/ directory
   # Open http://localhost:3000
   ```
   You should see:
   - 🔵 Blue pins for warehouses
   - 🟠 Orange polygons for safe zones

#### Troubleshooting

**"Connection refused"**
- PostgreSQL not running: `docker-compose up -d`

**"Database does not exist"**
- Create it first: `createdb -U geosafe_user geosafe`
- Or update docker-compose.yml `POSTGRES_DB` value

**"relation 'users' does not exist"**
- Run migrations: `cd backend && alembic upgrade head`

**Geometry not appearing on map**
- Check if geometry serialization works:
  ```bash
  curl http://localhost:8000/api/warehouses/ | jq '.[] | .location'
  ```
  Should output GeoJSON like: `{"type": "Point", "coordinates": [28.9784, 41.0082]}`

#### Clearing Database

To reset and reseed:

```bash
# From PostgreSQL
DROP TABLE inventory_movements;
DROP TABLE warehouse_inventory;
DROP TABLE warehouses;
DROP TABLE safe_zones;
DROP TABLE items;
DROP TABLE users;

# Then run seeding again
python scripts/seed_db.py
```

Or use Docker to reset the database volume:

```bash
docker-compose down -v  # Removes volume
docker-compose up       # Recreates fresh database
python scripts/seed_db.py
```

#### Adding More Data

To add custom warehouses/zones:

1. Edit `SAMPLE_WAREHOUSES` or `SAMPLE_SAFE_ZONES` in `seed_db.py`
2. Use Istanbul coordinate system:
   - Istanbul is roughly: Lon 28.8-29.3, Lat 40.95-41.3
   - Ankara: Lon 32.7-32.9, Lat 39.8-39.95
3. Run script again

#### Database Schema Reference

**Warehouses Table**
```sql
SELECT id, name, ST_AsText(location), capacity, status 
FROM warehouses;
```

**SafeZones Table**
```sql
SELECT id, name, ST_AsText(geometry), capacity, status 
FROM safe_zones;
```

**Convert WKT to GeoJSON (in SQL)**
```sql
SELECT row_to_json(t) FROM (
  SELECT ST_AsGeoJSON(location) as geometry FROM warehouses
) t;
```

---

**Need more help?** Check the backend README or frontend README in their respective directories.
