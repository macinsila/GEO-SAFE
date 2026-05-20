# 🌍 GeoSafe

**Neighborhood-based Disaster Safety & Logistics Management System**

A modern web application that helps citizens find the nearest safe gathering areas during disasters and track real-time availability of emergency supplies at logistics depots.

---

## 🎯 Project Overview

**Problem:** During disasters (earthquakes, floods, fires), citizens need to quickly locate:
- 🛡️ Nearest safe gathering areas
- 🏭 Available emergency supplies (food, water, medicine, etc.)
- 📍 Exact coordinates and directions

**Solution:** GeoSafe is a **geospatial web application** that:
- 📍 Displays safe zones and logistics warehouses on an interactive map
- 🗺️ Uses PostGIS for efficient geographic queries
- 📊 Shows real-time inventory at each warehouse
- 👥 Helps administrators manage supplies and evacuation points

---

## ✨ Features

### For Citizens
- 🗺️ **Interactive Map**: OpenStreetMap with Leaflet
- 📍 **Click Coordinates**: Get exact lat/lng of any location
- 🔵 **Warehouse Markers**: Blue pins showing logistics depots
- 🟠 **Safe Zones**: Orange polygons showing safe gathering areas
- 📱 **Mobile-Friendly**: Responsive design for phones and tablets

### For Administrators
- 📊 **Inventory Management**: Track supplies at each warehouse
- 🏢 **Zone Management**: Create and manage safe gathering areas
- 👥 **User Management**: Control who can access the system
- 📈 **Real-time Updates**: Instant inventory changes

---

## 🛠️ Tech Stack

### Backend
- **Python 3.11** - Language
- **FastAPI** - Web framework (async, fast, modern)
- **SQLAlchemy** - ORM for database
- **PostgreSQL + PostGIS** - Spatial database
- **Alembic** - Database migrations
- **Uvicorn** - ASGI server

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Leaflet** - Interactive mapping
- **Axios** - HTTP client
- **CSS3** - Responsive styling

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **PostgreSQL 15 + PostGIS 3.3** - Geospatial database

---

## 📁 Project Structure

```
geosafe2/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API endpoints (warehouses, safe_zones)
│   │   ├── models/            # SQLAlchemy models with PostGIS geometries
│   │   ├── db/                # Database connection and sessions
│   │   ├── schemas.py         # Pydantic models (with geometry serialization)
│   │   └── main.py            # FastAPI app entry point
│   ├── alembic/               # Database migrations
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components (Map, etc.)
│   │   ├── services/          # API layer
│   │   ├── types/             # TypeScript interfaces
│   │   ├── styles/            # CSS files
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/                    # Utility scripts
│   ├── seed_db.py             # Database seeding script
│   ├── setup_all.py           # One-command setup
│   └── README.md
│
├── docker-compose.yml         # Docker services definition
├── backend/
│   ├── requirements.txt       # Backend runtime dependencies
│   └── requirements-test.txt  # Backend test dependencies
├── SETUP_GUIDE.md            # Detailed setup instructions
├── QUICKSTART.ps1            # Windows quick start script
└── README.md                 # This file
```

---

## 🚀 Quick Start

### Option 1: Automated Setup (Windows PowerShell)

```powershell
.\QUICKSTART.ps1
```

This script automatically:
1. Checks prerequisites
2. Starts Docker containers
3. Runs database migrations
4. Seeds sample data
5. Installs dependencies

### Option 2: Manual Setup (All Platforms)

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed step-by-step instructions.

**TL;DR:**
```bash
# 1. Start database
docker-compose up -d

# 2. Configure backend environment
# Copy backend/.env.example to backend/.env and set JWT_SECRET to a long random value.
# The API fails fast if JWT_SECRET is missing or uses a known placeholder.

# 3. Install dependencies
pip install -r backend/requirements.txt -r backend/requirements-test.txt

# 4. Run migrations
cd backend && alembic -c alembic/alembic.ini upgrade head && cd ..

# 5. Seed data
python scripts/seed_db.py

# 6. Start backend (Terminal 1)
cd backend && uvicorn app.main:app --reload

# 7. Start frontend (Terminal 2)
cd frontend && npm install && npm start
```

**Sprint 1 verification commands:**
```powershell
$env:JWT_SECRET="replace-with-32-plus-char-random-secret"
docker compose up -d db
cd backend
alembic -c alembic/alembic.ini upgrade head
cd ..

# Create and use a separate test DB. Never run pytest against geosafe_db.
docker exec geosafe_db psql -U geosafe_user -d postgres -c "CREATE DATABASE geosafe_test_db"
$env:TEST_DATABASE_URL="postgresql://geosafe_user:geosafe_pass@localhost:5432/geosafe_test_db"
pytest backend/tests
npm run build
npm test -- --watchAll=false
```

**Then visit:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs

---

## 📊 Sample Data

After seeding, the database includes:

### Warehouses (5 total, Istanbul neighborhoods)
| Name | Location | Capacity | Status |
|------|----------|----------|--------|
| Beyoğlu Supply Depot | (28.9784, 41.0082) | 500 | active |
| Fatih Emergency Center | (28.9595, 41.0096) | 300 | active |
| Şişli Regional Hub | (28.9839, 41.0523) | 750 | active |
| Beşiktaş Coastal Warehouse | (29.0009, 41.0520) | 600 | active |
| Kadıköy Distribution Center | (29.0234, 40.9949) | 550 | active |

### Safe Zones (4 total, Istanbul)
| Name | Capacity | Type | Status |
|------|----------|------|--------|
| Taksim Square Safe Zone | 2000 | urban_square | active |
| Sultanahmet Park Safe Zone | 3000 | historic_park | active |
| Ortaköy Seafront Safe Zone | 1500 | waterfront | active |
| Göztepe Sports Complex | 2500 | sports_facility | active |

---

## � Deployment (Vercel & Render)

### Frontend (Vercel)
The React frontend can be easily deployed to Vercel. To avoid Python backend build errors (`No FastAPI entrypoint found` or `pg_config executable not found`), you **must** configure Vercel to only build the frontend:

1. Import your GitHub repository in Vercel.
2. Go to **Settings > General** or configure during import:
   - **Root Directory:** `GEO-SAFE/frontend`
   - **Framework Preset:** Create React App
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
3. Add Environment Variables:
   - `REACT_APP_API_URL`: Your deployed backend URL (e.g., `https://geosafe-api.onrender.com`).

### Backend (Render / Railway)
Vercel is Serverless and not ideal for a FastAPI + PostGIS heavy application. Use Render or Railway instead:
1. Create a Web Service and point it to the repository.
2. **Root Directory:** `GEO-SAFE`
3. **Build Command:** `pip install -r requirements.txt` (This uses `psycopg2-binary` to avoid build errors).
4. **Start Command:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables Needed:**
   - `DATABASE_URL`: A PostgreSQL + PostGIS database connection string.
   - `JWT_SECRET`: Used for auth tokens (generate a long random string).

---

## �🗺️ Understanding GIS & PostGIS

### What is PostGIS?

PostGIS is a PostgreSQL extension that adds **geospatial capabilities**:
- Store locations as Points, Lines, Polygons, etc.
- Perform spatial queries (distance, containment, intersection)
- Create spatial indexes for fast queries
- Use standard GeoJSON format

### Data Format: GeoJSON

```json
{
  "type": "Point",
  "coordinates": [28.9784, 41.0082]
}
```

- **coordinates**: `[longitude, latitude]` (not lat/lon!)
- **SRID 4326**: WGS84 (standard world coordinate system)

### Queries

**Find all warehouses:**
```sql
SELECT id, name, ST_AsGeoJSON(location) as geojson FROM warehouses;
```

**Find nearest warehouse to a point:**
```sql
SELECT id, name, ST_DistanceSphere(location, ST_MakePoint(28.97, 41.01))
FROM warehouses
ORDER BY ST_DistanceSphere(location, ST_MakePoint(28.97, 41.01))
LIMIT 1;
```

**Check if point is inside safe zone:**
```sql
SELECT name FROM safe_zones
WHERE ST_Contains(geometry, ST_MakePoint(28.97, 41.00))
LIMIT 1;
```

---

## 📚 API Documentation

### Interactive Docs
Visit `http://localhost:8000/docs` (Swagger) or `http://localhost:8000/redoc` (ReDoc)

### Main Endpoints

**Warehouses:**
- `GET /api/v1/warehouses` - List public warehouse summaries without operational address/contact metadata
- `GET /api/v1/warehouses/{id}` - Get a public warehouse summary
- `GET /api/v1/warehouses/admin` - Admin-only warehouse details

**Safe Zones:**
- `GET /api/v1/safe-zones` - List public safe zone summaries without raw metadata
- `GET /api/v1/safe-zones/{id}` - Get a public safe zone summary
- `GET /api/v1/safe-zones/admin` - Admin-only safe zone details

**Emergency:**
- `POST /api/v1/emergency` - Create emergency report (rate limited: 5 requests/min per IP)

The anonymous rate limit is in-memory and keyed by `request.client.host`. Production
deployments behind proxies or multiple API workers must configure trusted proxy headers
and/or a shared distributed limiter before relying on it as an abuse-control boundary.

**Health:**
- `GET /health` - Backend health check
- `GET /` - Simple health check

### Response Examples

**Warehouse:**
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

**Safe Zone:**
```json
{
  "id": 1,
  "name": "Taksim Square Safe Zone",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[28.975, 41.006], [28.982, 41.006], [28.982, 41.011], [28.975, 41.011], [28.975, 41.006]]]
  },
  "capacity": 2000,
  "capacity_type": "persons",
  "status": "active",
  "created_at": "2025-12-24T12:00:00"
}
```

---

## 🧪 Testing

### Test Backend Endpoints

```bash
# Get all warehouses
curl http://localhost:8000/api/v1/warehouses | jq

# Get all safe zones
curl http://localhost:8000/api/v1/safe-zones | jq

# Health check
curl http://localhost:8000/health
```

### Test Frontend

1. Open http://localhost:3000
2. See the interactive map
3. Click on the map to get coordinates
4. Blue pins = warehouses
5. Orange polygons = safe zones

### Test Database

```bash
# Connect to PostgreSQL
docker exec -it geosafe2-db-1 psql -U geosafe_user -d geosafe

# In psql:
SELECT id, name, ST_AsText(location) FROM warehouses;
SELECT id, name, ST_AsText(geometry) FROM safe_zones;
```

---

## 🔧 Development

### Making Changes

**Backend:**
- Edit files in `backend/app/`
- Uvicorn auto-reloads on save
- View docs at http://localhost:8000/docs

**Frontend:**
- Edit files in `frontend/src/`
- React auto-reloads on save
- Check browser console for errors (F12)

### Adding New Features

1. **New API endpoint:**
   - Add SQLAlchemy model in `backend/app/models/`
   - Create Pydantic schema in `backend/app/schemas.py`
   - Add router in `backend/app/api/`
   - Register in `backend/app/main.py`

2. **New database migration:**
   ```bash
   cd backend
   alembic revision --autogenerate -m "description"
   alembic -c alembic/alembic.ini upgrade head
   ```

3. **New React component:**
   - Create file in `frontend/src/components/`
   - Export from `frontend/src/components/index.ts`
   - Use in `frontend/src/App.tsx`

---

## 🐛 Troubleshooting

### "Cannot connect to database"
- Check Docker: `docker ps`
- Restart: `docker-compose restart`

### "CORS errors"
- Backend must be running on http://localhost:8000
- Check frontend `.env.local` has `REACT_APP_API_BASE_URL=http://localhost:8000`

### "No data on map"
1. Backend running? → http://localhost:8000/docs
2. Database seeded? → `python scripts/seed_db.py`
3. Check browser console (F12 → Console)

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for more troubleshooting.

---

## 📖 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed setup and installation
- **[backend/README.md](backend/README.md)** - Backend-specific documentation
- **[frontend/README.md](frontend/README.md)** - Frontend-specific documentation
- **[scripts/README.md](scripts/README.md)** - Script documentation

---

## 🎓 Learning Resources

### For First-Year Students

**React Concepts:**
- Components = reusable UI pieces
- Props = inputs to components
- State = internal data that changes
- Hooks = functions like useState, useEffect

**FastAPI Basics:**
- Routes = endpoints (URLs)
- Models = database tables
- Schemas = request/response validation
- Dependencies = injection (automatic parameter passing)

**PostGIS Basics:**
- GeoJSON = standard format for geographic data
- Point = single coordinate `[lon, lat]`
- Polygon = ring of coordinates
- SRID 4326 = standard coordinate system (lat/lon)

### Recommended Tutorials
- React: https://react.dev/learn
- FastAPI: https://fastapi.tiangolo.com/
- Leaflet: https://leafletjs.com/examples.html
- PostGIS: https://postgis.net/documentation/

---

## 🤝 Team

- **Yazılım Mimarı & Lead Developer:** GitHub Copilot
- **Team Size:** 3 university students (1st year)
- **Project:** University capstone project

---

## 📋 Roadmap

### Phase 1: MVP (Current)
- ✅ Interactive map with warehouses and safe zones
- ✅ Click to get coordinates
- ✅ Backend API with PostGIS
- ✅ React frontend with Leaflet
- ✅ Sample data seeding

### Phase 2: Inventory Management
- [ ] Add/update warehouse inventory
- [ ] Create inventory movement logs
- [ ] Show stock levels on map
- [ ] Alert for low stock

### Phase 3: Geospatial Features
- [ ] Find nearest safe zone
- [ ] Calculate distances
- [ ] Route optimization
- [ ] Search by radius

### Phase 4: User Management
- [ ] Login/logout
- [ ] User roles (admin, operator, viewer)
- [ ] JWT authentication
- [ ] Access control

### Phase 5: Real-time Features
- [ ] WebSocket for live updates
- [ ] Emergency alerts
- [ ] Push notifications
- [ ] Real-time inventory sync

---

## 📞 Support

- Check **SETUP_GUIDE.md** for common issues
- Read **README.md** files in backend/, frontend/, scripts/
- Check Docker logs: `docker-compose logs`
- Check browser console: F12 → Console
- Check backend terminal for errors

---

## 📄 License

MIT License - Feel free to use for learning and projects.

---

## ✨ Success Indicator

You'll know everything is working when:

1. ✅ `docker ps` shows running containers
2. ✅ Backend returns data: `curl http://localhost:8000/api/v1/warehouses`
3. ✅ Frontend loads: http://localhost:3000
4. ✅ Map shows 5 blue pins and 4 orange areas
5. ✅ Clicking map shows coordinates
6. ✅ API docs work: http://localhost:8000/docs

---

**Happy coding! 🎉 GeoSafe is ready for development.**

For detailed setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)
