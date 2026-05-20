# 🚀 GeoSafe Complete Setup Guide

**GeoSafe**: Neighborhood-based Disaster Safety & Logistics Management System

This guide walks through setting up the entire GeoSafe stack: PostgreSQL + PostGIS, FastAPI backend, React frontend, and sample data.

---

## 📋 Prerequisites

- **Docker & Docker Compose** installed ([install here](https://docs.docker.com/get-docker/))
- **Node.js 16+** and npm ([install here](https://nodejs.org/))
- **Python 3.11+** ([install here](https://www.python.org/))
- **Git** (optional, for version control)

---

## ⚙️ Step 1: Start Infrastructure (PostgreSQL + PostGIS)

From the project root directory:

```bash
docker-compose up -d
```

**What this does:**
- 🗄️ Starts PostgreSQL 15 with PostGIS 3.3 on port `5432`
- 📦 Creates `geosafe` database
- 👤 Creates user `geosafe_user` with password `geosafe_pass`

**Verify it's running:**
```bash
docker-compose ps
```

Expected output:
```
NAME      IMAGE                    STATUS
geosafe2-db-1  postgis/postgis:15-3.3  Up About a minute
```

---

## ⚙️ Step 2: Setup Backend (Python/FastAPI)

### Configure Environment Variables

Copy backend/.env.example to backend/.env and update the following:

- `JWT_SECRET` (required; use a long random value, not the placeholder)
- `CORS_ORIGINS` (comma-separated allowed origins)
- `AUTO_CREATE_TABLES` (optional; default `false`, only set to `true` for local/test if you explicitly want startup to create tables)

### Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt -r requirements-test.txt
```

**What's installed:**
- `fastapi` - Web framework
- `sqlalchemy` - ORM database library
- `asyncpg` - PostgreSQL async driver
- `geoalchemy2` - PostGIS support
- `alembic` - Database migrations
- `pydantic` - Data validation

### Run Database Migrations

```bash
cd backend
alembic -c alembic/alembic.ini upgrade head
```

**What this does:**
- Connects to PostgreSQL
- Creates tables: `users`, `items`, `warehouses`, `safe_zones`, `warehouse_inventory`, `inventory_movements`
- Enables PostGIS extension
- Creates spatial indexes on geometry columns

You should see:
```
INFO [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO [alembic.runtime.migration] Will assume transactional DDL.
INFO [alembic.runtime.migration] Running upgrade  -> 001_initial, done
```

---

## 🌱 Step 3: Seed Database with Sample Data

```bash
python scripts/seed_db.py
```

**What gets created:**
- 👤 1 Admin user
- 📦 6 Item types (food, water, medicine, etc.)
- 🏭 5 Warehouses in Istanbul neighborhoods
- 🛡️ 4 Safe Zones in Istanbul neighborhoods

**Expected output:**
```
🌱 Starting GeoSafe Database Seeding...
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
```

---

## 🚀 Step 4: Start Backend Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**What this does:**
- Starts FastAPI server on `http://localhost:8000`
- Enables live reload (code changes auto-restart)
- `--reload` is for development; remove for production

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

**Test backend:**
- Visit `http://localhost:8000/docs` for interactive API documentation
- Try endpoint: `http://localhost:8000/api/v1/warehouses`

You should see JSON response with warehouse data.

---

## 🎨 Step 5: Setup Frontend (React)

### Install Frontend Dependencies

In a **new terminal** (keep backend running):

```bash
cd frontend
npm install
```

**What's installed:**
- `react` + `react-dom` - UI framework
- `react-leaflet` - React wrapper for Leaflet maps
- `leaflet` - Interactive mapping library
- `axios` - HTTP client
- `typescript` - Type safety

### Start Frontend Server

```bash
npm start
```

**What this does:**
- Starts React development server on `http://localhost:3000`
- Auto-opens browser
- Enables hot reload (code changes auto-refresh)

**Expected output:**
```
Compiled successfully!

You can now view geosafe-frontend in the browser.

Local:            http://localhost:3000
```

---

## ✅ Step 6: Verify Everything Works

### 1. **Check Backend Health**
```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "GeoSafe Backend",
  "version": "0.1.0"
}
```

### 2. **Check Warehouse Endpoint**
```bash
curl http://localhost:8000/api/v1/warehouses | jq '.data'
```

Response should show 5 warehouses with Point geometries:
```json
[
  {
    "id": 1,
    "name": "Beyoğlu Supply Depot",
    "location": {
      "type": "Point",
      "coordinates": [28.9784, 41.0082]
    },
    "capacity": 500,
    "status": "active",
    "created_at": "2025-12-24T12:00:00"
  },
  ...
]
```

### 3. **Check Safe Zones Endpoint**
```bash
curl http://localhost:8000/api/v1/safe-zones | jq '.data'
```

Response should show 4 safe zones with Polygon geometries:
```json
[
  {
    "id": 1,
    "name": "Taksim Square Safe Zone",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[28.975, 41.006], [28.982, 41.006], ...]]
    },
    "capacity": 2000,
    "capacity_type": "persons",
    "status": "active",
    "created_at": "2025-12-24T12:00:00"
  },
  ...
]
```

### 4. **Check Frontend Map**

Open `http://localhost:3000` in your browser. You should see:

- 🔵 **Blue pins** = Warehouses (5 total)
- 🟠 **Orange polygons** = Safe zones (4 total)
- 🗺️ **OpenStreetMap** background
- 📍 **Click on map** to get coordinates
- 📋 **Right panel** shows last clicked coordinates

---

## 🧭 Understanding the Data Flow

```
User clicks on map
         ↓
Frontend (React) captures click event
         ↓
Browser JavaScript gets lat/lng coordinates
         ↓
Displays coordinates in right panel
         ↓
────────────────────────────────────
         ↓
Frontend loads on page open
         ↓
React calls backend API (axios)
         ↓
Backend fetches from PostgreSQL (FastAPI)
         ↓
PostGIS returns geometry as GeoJSON
         ↓
Pydantic serializes to JSON response
         ↓
Frontend receives warehouse/safe zone data
         ↓
Leaflet renders markers and polygons on map
```

---

## 📊 Project Structure

```
geosafe2/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── warehouses.py   # GET /api/v1/warehouses
│   │   │   └── safe_zones.py   # GET /api/v1/safe-zones
│   │   ├── models/
│   │   │   ├── warehouse.py    # SQLAlchemy model with Point geometry
│   │   │   ├── safe_zone.py    # SQLAlchemy model with Polygon geometry
│   │   │   └── ...other models
│   │   ├── db/
│   │   │   └── session.py      # Database connection
│   │   ├── schemas.py          # Pydantic models (with geometry serialization)
│   │   └── main.py             # FastAPI app entry point
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial_schema.py  # Creates tables + PostGIS
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Map.tsx         # Leaflet map with markers/polygons
│   │   ├── services/
│   │   │   └── api.ts          # Backend API calls
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript interfaces
│   │   ├── App.tsx             # Main component
│   │   └── index.tsx           # Entry point
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   ├── seed_db.py              # Database seeding script
│   ├── setup_all.py            # One-command setup
│   └── README.md
├── docker-compose.yml          # PostgreSQL + PostGIS
├── backend/
│   ├── requirements.txt        # Backend runtime dependencies
│   └── requirements-test.txt   # Backend test dependencies
└── README.md
```

---

## 🐛 Troubleshooting

### "Cannot connect to database"
```bash
# Check Docker is running
docker ps

# Restart containers
docker-compose restart db

# Check logs
docker-compose logs db
```

### "CORS error: Access to XMLHttpRequest blocked"
- Make sure backend is running on `http://localhost:8000`
- Check `REACT_APP_API_BASE_URL` in `.env.local` (should be `http://localhost:8000`)

### "Map not showing data"
1. Check browser console (F12 → Console tab)
2. Check if backend returns data: `curl http://localhost:8000/api/v1/warehouses`
3. Check Network tab in F12 to see API requests

### "No migrations found" when running `alembic -c alembic/alembic.ini upgrade head`
```bash
cd backend
# Check if alembic folder exists
ls alembic/

# If not, initialize:
alembic init alembic
```

### "Table already exists" error
```bash
# Drop all tables (WARNING: deletes data!)
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS warehouse_inventory CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS safe_zones CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS users CASCADE;
"

# Re-run migrations and seeding
alembic -c alembic/alembic.ini upgrade head
python scripts/seed_db.py
```

### "ModuleNotFoundError" when running seed script
```bash
# Make sure you're in project root
cd /path/to/geosafe2

# Install dependencies first
pip install -r backend/requirements.txt -r backend/requirements-test.txt

# Then run
python scripts/seed_db.py
```

---

## 📚 API Documentation

### Backend Swagger Docs
Visit `http://localhost:8000/docs` for interactive API explorer.

**Available endpoints:**
- `GET /` - Health check
- `GET /health` - Detailed health check
- `GET /api/v1/warehouses` - List public warehouse summaries
- `GET /api/v1/warehouses/{id}` - Get a public warehouse summary
- `GET /api/v1/safe-zones` - List public safe zone summaries
- `GET /api/v1/safe-zones/{id}` - Get a public safe zone summary

### Response Formats

**Warehouse (Point geometry):**
```json
{
  "id": 1,
  "name": "Beyoğlu Supply Depot",
  "location": {
    "type": "Point",
    "coordinates": [28.9784, 41.0082]
  },
  "capacity": 500,
  "status": "active",
  "created_at": "2025-12-24T12:00:00"
}
```

**Safe Zone (Polygon geometry):**
```json
{
  "id": 1,
  "name": "Taksim Square Safe Zone",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [[28.975, 41.006], [28.982, 41.006], [28.982, 41.011], [28.975, 41.011], [28.975, 41.006]]
    ]
  },
  "capacity": 2000,
  "capacity_type": "persons",
  "status": "active",
  "created_at": "2025-12-24T12:00:00"
}
```

---

## 🎯 Next Development Steps

1. **Inventory Management**
   - Add endpoints to update warehouse stock
   - Create inventory movement logs

2. **Geospatial Queries**
   - Find nearest safe zone to user location
   - Check if point is inside safe zone
   - Distance-based warehouse recommendations

3. **User Authentication**
   - Login/logout endpoints
   - JWT token authorization
   - Role-based access control

4. **Frontend Enhancements**
   - Search warehouses by name
   - Filter by distance
   - Show inventory at each warehouse
   - Mobile app version

5. **Real-time Updates**
   - WebSocket for live inventory changes
   - Push notifications for emergency alerts

---

## 📖 Learning Resources

### PostGIS for Beginners
- **GeoJSON**: Standard format for representing geographic data
  - Point: `{"type": "Point", "coordinates": [lon, lat]}`
  - Polygon: `{"type": "Polygon", "coordinates": [[[lon, lat], ...]]}`
  
- **WKT (Well-Known Text)**: Alternative geometry format
  - Point: `POINT(28.9784 41.0082)`
  - Polygon: `POLYGON((28.975 41.006, 28.982 41.006, ...))`

- **SRID 4326**: Standard coordinate system (WGS84 - latitude/longitude)

### FastAPI + SQLAlchemy
- FastAPI docs: https://fastapi.tiangolo.com/
- SQLAlchemy async: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- GeoAlchemy2: https://geoalchemy-2.readthedocs.io/

### React + Leaflet
- React docs: https://react.dev/
- Leaflet: https://leafletjs.com/
- React-Leaflet: https://react-leaflet.js.org/

---

## ✨ Success Checklist

- [ ] Docker containers running (`docker ps` shows db, backend, frontend)
- [ ] PostgreSQL with PostGIS created
- [ ] Alembic migrations applied
- [ ] Database seeded with 5 warehouses + 4 safe zones
- [ ] Backend running on `http://localhost:8000`
- [ ] Backend API docs accessible: `http://localhost:8000/docs`
- [ ] Frontend running on `http://localhost:3000`
- [ ] Map visible with blue pins and orange polygons
- [ ] Can click map and see coordinates
- [ ] API endpoints return GeoJSON

---

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Read individual README files:
   - `backend/README.md` - Backend specific docs
   - `frontend/README.md` - Frontend specific docs
   - `scripts/README.md` - Script documentation
3. Check Docker logs: `docker-compose logs -f`
4. Check browser console: F12 → Console tab
5. Check backend logs: Terminal where you ran `uvicorn`

---

**Happy coding! 🎉 GeoSafe is now ready for development.**
