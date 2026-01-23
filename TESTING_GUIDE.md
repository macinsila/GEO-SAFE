# 🧪 GeoSafe Testing & Verification Guide

Complete step-by-step guide to verify everything is working correctly.

---

## Prerequisites Check

### Windows PowerShell
```powershell
# Check Docker
docker --version
docker-compose --version

# Check Node.js
node --version
npm --version

# Check Python
python --version
```

Expected outputs:
- Docker version 20.10+
- Node.js version 16+
- Python 3.11+

---

## Phase 1: Infrastructure Testing

### Step 1.1 - Start Docker Containers

```powershell
cd c:\Users\90543\OneDrive\Desktop\geosafe2
docker-compose up -d
```

**Expected Output:**
```
[+] Running 2/2
 ✓ Container geosafe2-db-1 Started
 ✓ Network geosafe2_default Created
```

### Step 1.2 - Verify Containers Running

```powershell
docker-compose ps
```

**Expected Output:**
```
NAME         IMAGE                   STATUS
geosafe2-db-1 postgis/postgis:15-3.3  Up 10 seconds
```

### Step 1.3 - Test PostgreSQL Connection

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "SELECT version();"
```

**Expected Output:**
```
PostgreSQL 15.x ... with PostGIS 3.3.x
```

### Step 1.4 - Verify PostGIS Extension

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "SELECT PostGIS_Version();"
```

**Expected Output:**
```
3.3.x built with GEOS 3.x
```

✅ **Phase 1 Complete** if all tests pass.

---

## Phase 2: Database Setup Testing

### Step 2.1 - Check Database Exists

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -l | grep geosafe
```

**Expected Output:**
```
geosafe | geosafe_user | UTF8
```

### Step 2.2 - Install Python Dependencies

```powershell
cd backend
pip install -r ../requirements.txt
```

**Expected Output:** (no errors)
```
Successfully installed fastapi-... sqlalchemy-... geoalchemy2-...
```

### Step 2.3 - Run Database Migrations

```powershell
cd backend
alembic upgrade head
```

**Expected Output:**
```
INFO [alembic.runtime.migration] Running upgrade  -> 001_initial, done
```

### Step 2.4 - Verify Tables Created

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "\dt"
```

**Expected Output:**
```
           List of relations
 Schema |         Name         | Type
--------+----------------------+-------
 public | alembic_version      | table
 public | inventory_movements  | table
 public | items                | table
 public | safe_zones           | table
 public | users                | table
 public | warehouse_inventory  | table
 public | warehouses           | table
(7 rows)
```

### Step 2.5 - Verify PostGIS Tables

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
```

**Expected Output:**
```
        table_name
------------------------
 users
 items
 safe_zones
 warehouses
 warehouse_inventory
 inventory_movements
 alembic_version
(7 rows)
```

### Step 2.6 - Check Geometry Columns

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT f_table_name, f_geometry_column, geometry_type, srid 
FROM geometry_columns;"
```

**Expected Output:**
```
 f_table_name | f_geometry_column | geometry_type | srid
--------------+-------------------+---------------+------
 warehouses   | location          | Point         | 4326
 safe_zones   | geometry          | Polygon       | 4326
(2 rows)
```

✅ **Phase 2 Complete** if all tables and geometries verified.

---

## Phase 3: Data Seeding Testing

### Step 3.1 - Seed Database

```powershell
python scripts/seed_db.py
```

**Expected Output:**
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
   - 5 Warehouses
   - 4 Safe Zones
   - 6 Item Types
```

### Step 3.2 - Verify Warehouses in Database

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT id, name, ST_AsText(location), capacity FROM warehouses;"
```

**Expected Output:**
```
 id |           name            |              st_astext               | capacity
----+---------------------------+---------------------------------------+----------
  1 | Beyoğlu Supply Depot      | POINT(28.9784 41.0082)               |      500
  2 | Fatih Emergency Center    | POINT(28.9595 41.0096)               |      300
  3 | Şişli Regional Hub        | POINT(28.9839 41.0523)               |      750
  4 | Beşiktaş Coastal Warehouse | POINT(29.0009 41.052)                |      600
  5 | Kadıköy Distribution Center | POINT(29.0234 40.9949)              |      550
(5 rows)
```

### Step 3.3 - Verify Safe Zones in Database

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT id, name, ST_AsText(geometry), capacity FROM safe_zones LIMIT 1;"
```

**Expected Output:**
```
 id |        name         |                          st_astext                           | capacity
----+---------------------+------------------------------------------------------------+----------
  1 | Taksim Square Safe Zone | POLYGON((28.975 41.006,28.982 41.006,28.982 41.011,... | 2000
```

### Step 3.4 - Count All Data

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT 
  (SELECT count(*) FROM users) as users,
  (SELECT count(*) FROM items) as items,
  (SELECT count(*) FROM warehouses) as warehouses,
  (SELECT count(*) FROM safe_zones) as safe_zones;"
```

**Expected Output:**
```
 users | items | warehouses | safe_zones
-------+-------+------------+------------
     1 |     6 |          5 |          4
```

✅ **Phase 3 Complete** if data counts match.

---

## Phase 4: Backend API Testing

### Step 4.1 - Start Backend Server

**Terminal 1 - Backend:**
```powershell
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### Step 4.2 - Test Health Endpoint

**Terminal 2 - Test:**
```powershell
curl http://localhost:8000/health | jq
```

**Expected Output:**
```json
{
  "status": "healthy",
  "service": "GeoSafe Backend",
  "version": "0.1.0"
}
```

### Step 4.3 - Test Warehouses Endpoint

```powershell
curl http://localhost:8000/api/warehouses/ | jq '.[0]'
```

**Expected Output:**
```json
{
  "id": 1,
  "name": "Beyoğlu Supply Depot",
  "location": {
    "type": "Point",
    "coordinates": [28.9784, 41.0082]
  },
  "address": "Taksim District, Beyoğlu, Istanbul",
  "capacity": 500,
  "status": "active",
  "created_at": "2025-12-24T12:00:00"
}
```

### Step 4.4 - Count Warehouses Response

```powershell
curl http://localhost:8000/api/warehouses/ | jq 'length'
```

**Expected Output:**
```
5
```

### Step 4.5 - Test Safe Zones Endpoint

```powershell
curl http://localhost:8000/api/safe-zones/ | jq '.[0]'
```

**Expected Output:**
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

### Step 4.6 - Count Safe Zones Response

```powershell
curl http://localhost:8000/api/safe-zones/ | jq 'length'
```

**Expected Output:**
```
4
```

### Step 4.7 - Test Specific Warehouse

```powershell
curl http://localhost:8000/api/warehouses/1 | jq '.name'
```

**Expected Output:**
```
"Beyoğlu Supply Depot"
```

### Step 4.8 - Test API Documentation

Open in browser: `http://localhost:8000/docs`

**Expected:**
- Swagger UI interface loads
- Shows all endpoints with descriptions
- "Try it out" buttons work
- Can execute endpoints from docs

### Step 4.9 - Verify Geometry Serialization

```powershell
curl http://localhost:8000/api/warehouses/1 | jq '.location'
```

**Expected Output:**
```json
{
  "type": "Point",
  "coordinates": [28.9784, 41.0082]
}
```

Note: Coordinates must be `[longitude, latitude]` (not reversed)

✅ **Phase 4 Complete** if all API endpoints respond correctly.

---

## Phase 5: Frontend Setup Testing

### Step 5.1 - Install Frontend Dependencies

**Terminal 3 - Frontend:**
```powershell
cd frontend
npm install
```

**Expected Output:**
```
added XXX packages in XXs
```

### Step 5.2 - Check Node Modules

```powershell
ls node_modules | findstr "react leaflet axios"
```

**Expected Output:**
```
react
react-dom
leaflet
react-leaflet
axios
```

### Step 5.3 - Start Frontend Server

```powershell
npm start
```

**Expected Output:**
```
Compiled successfully!

You can now view geosafe-frontend in the browser.

Local:            http://localhost:3000
```

Browser should auto-open to `http://localhost:3000`

### Step 5.4 - Verify Frontend Loads

**In Browser:**
1. Open `http://localhost:3000`
2. Should see:
   - Header: "🌍 GeoSafe"
   - Subtitle: "Neighborhood-based Disaster Safety & Logistics Management"
   - Interactive map in the center
   - "Loading map data..." message briefly

✅ **Phase 5 Complete** if frontend loads without errors.

---

## Phase 6: Map Visualization Testing

### Step 6.1 - Wait for Map to Load

Wait 2-3 seconds for data to load from backend.

**Expected:**
- Map displays with OpenStreetMap tiles
- Zoom controls on left
- Attribution on bottom right

### Step 6.2 - Verify Warehouse Markers

**Expected:**
- 5 blue pins visible on map
- Located at approximate Istanbul coordinates
- Clustered in urban areas

**Locations should be near:**
- (28.98, 41.01) - Beyoğlu/Fatih
- (28.98, 41.05) - Şişli
- (29.00, 41.05) - Beşiktaş
- (29.02, 40.99) - Kadıköy

### Step 6.3 - Click on Warehouse Marker

Click on a blue pin.

**Expected:**
- Popup appears with warehouse info
- Shows: name, status, capacity, address

### Step 6.4 - Verify Safe Zone Polygons

**Expected:**
- 4 orange/outlined areas visible
- Semi-transparent orange fill
- Polygons at warehouse locations

**Locations should be near:**
- Taksim Square area
- Sultanahmet area
- Ortaköy area
- Göztepe area

### Step 6.5 - Click on Safe Zone Polygon

Click on an orange polygon.

**Expected:**
- Popup appears with zone info
- Shows: name, status, capacity, capacity_type

### Step 6.6 - Test Click Coordinates

Click anywhere on the map.

**Expected:**
- Right panel updates with "Last Clicked Location"
- Shows latitude (6 decimal places)
- Shows longitude (6 decimal places)
- Shows time of click
- Copy button available

### Step 6.7 - Test Copy Button

Click the "Copy" button in the coordinates panel.

**Expected:**
- Alert shows "Coordinates copied to clipboard!"
- Can paste coordinates elsewhere

### Step 6.8 - Test Pan and Zoom

- Drag the map around
- Use scroll wheel to zoom
- Use zoom buttons (+/-)

**Expected:**
- Map moves smoothly
- Markers and polygons stay in correct positions
- No lag or stuttering

✅ **Phase 6 Complete** if all map features work.

---

## Phase 7: Network Traffic Testing

### Step 7.1 - Open Browser DevTools

Press `F12` in browser.

### Step 7.2 - Go to Network Tab

Click "Network" tab in DevTools.

### Step 7.3 - Reload Page

Press `Ctrl+R` or `Cmd+R`.

### Step 7.4 - Check API Calls

Look for requests to:
- `http://localhost:8000/api/warehouses/`
- `http://localhost:8000/api/safe-zones/`

**Expected:**
- Both requests show Status 200
- Response shows valid JSON with warehouse/zone data
- Response size ~1-2 KB each

### Step 7.5 - Check Response Format

Click on `/api/warehouses/` request.

**In Preview tab:**
```json
[
  {
    "id": 1,
    "name": "Beyoğlu Supply Depot",
    "location": {
      "type": "Point",
      "coordinates": [28.9784, 41.0082]
    },
    ...
  },
  ...
]
```

### Step 7.6 - Check Console for Errors

Click "Console" tab.

**Expected:**
- No red error messages
- May see info/warning logs
- No "Failed to fetch" messages

✅ **Phase 7 Complete** if all API calls succeed.

---

## Phase 8: Error Handling Testing

### Step 8.1 - Test Backend Offline

1. Stop backend server (Ctrl+C in backend terminal)
2. Try to click map or refresh frontend page

**Expected:**
- Error message appears: "Failed to load map data. Check backend connection."
- No data on map
- Frontend remains functional (no crash)

### Step 8.2 - Restart Backend

```powershell
# In backend terminal
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 8.3 - Refresh Frontend

Press F5 or reload in browser.

**Expected:**
- Map reloads
- Data appears again
- Warehouses and zones visible

### Step 8.4 - Test Invalid Endpoint

```powershell
curl http://localhost:8000/api/invalid-endpoint
```

**Expected Output:**
```json
{"detail":"Not Found"}
```

### Step 8.5 - Test 404 for Warehouse

```powershell
curl http://localhost:8000/api/warehouses/999
```

**Expected Output:**
```json
{"detail":"Warehouse 999 not found"}
```

✅ **Phase 8 Complete** if error handling works.

---

## Phase 9: Data Integrity Testing

### Step 9.1 - Verify No Duplicate Warehouses

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT name, COUNT(*) FROM warehouses GROUP BY name HAVING COUNT(*) > 1;"
```

**Expected Output:**
```
(0 rows)
```

No duplicates = good

### Step 9.2 - Verify Warehouse Geometries Valid

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT name, ST_IsValid(location) FROM warehouses;"
```

**Expected Output:**
```
           name            | st_isvalid
---------------------------+------------
 Beyoğlu Supply Depot      | t
 Fatih Emergency Center    | t
 Şişli Regional Hub        | t
 Beşiktaş Coastal Warehouse | t
 Kadıköy Distribution Center | t
(5 rows)
```

All `t` (true) = valid geometries

### Step 9.3 - Verify Safe Zone Geometries Valid

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT name, ST_IsValid(geometry) FROM safe_zones;"
```

**Expected Output:**
```
        name         | st_isvalid
---------------------+------------
 Taksim Square Safe Zone | t
 Sultanahmet Park Safe Zone | t
 Ortaköy Seafront Safe Zone | t
 Göztepe Sports Complex Safe Zone | t
(4 rows)
```

All `t` (true) = valid geometries

### Step 9.4 - Verify Coordinate Ranges

```powershell
docker exec geosafe2-db-1 psql -U geosafe_user -d geosafe -c "
SELECT 
  MIN(ST_X(location)) as min_lon,
  MAX(ST_X(location)) as max_lon,
  MIN(ST_Y(location)) as min_lat,
  MAX(ST_Y(location)) as max_lat
FROM warehouses;"
```

**Expected Output:**
```
   min_lon   |   max_lon   |   min_lat   |   max_lat
--------------+-------------+-------------+----------
    28.9595  |    29.0234  |    40.9949  |    41.0523
```

All within Istanbul bounds ✓

✅ **Phase 9 Complete** if data integrity verified.

---

## Phase 10: Performance Testing

### Step 10.1 - Check Page Load Time

1. Open DevTools (F12)
2. Go to Network tab
3. Reload page (Ctrl+R)

**Expected:**
- Page loads in < 2 seconds
- Map data loads in < 500ms
- No slow network requests

### Step 10.2 - Check Network Timeline

In Network tab, look at waterfall chart.

**Expected:**
- HTML loads first
- JavaScript bundle next
- API calls parallel
- No sequential blocking

### Step 10.3 - Test API Response Time

```powershell
# Measure response time
$start = Get-Date
curl http://localhost:8000/api/warehouses/ | Out-Null
$end = Get-Date
Write-Host "Response time: $($end - $start)"
```

**Expected:**
- Response time < 100ms
- Typically 10-50ms

### Step 10.4 - Test with Browser Throttling

In DevTools:
1. Network tab
2. Click "Throttling" dropdown (usually set to "No throttling")
3. Select "Slow 3G"
4. Reload page

**Expected:**
- Page still loads correctly
- May take 5-10 seconds
- Data still appears correctly
- Responsive to interactions

✅ **Phase 10 Complete** if performance acceptable.

---

## Summary Checklist

### Database ✅
- [ ] PostgreSQL running
- [ ] PostGIS extension installed
- [ ] All 7 tables created
- [ ] Geometry columns verified
- [ ] 5 warehouses + 4 safe zones + 6 items seeded
- [ ] No data duplication
- [ ] Geometries valid

### Backend ✅
- [ ] Server running on :8000
- [ ] Health endpoint works
- [ ] Warehouses endpoint returns 5 records
- [ ] Safe zones endpoint returns 4 records
- [ ] GeoJSON format correct
- [ ] API docs load at /docs
- [ ] Error handling works
- [ ] Response time < 100ms

### Frontend ✅
- [ ] App loads at localhost:3000
- [ ] Map displays with tiles
- [ ] 5 blue warehouse markers visible
- [ ] 4 orange safe zone polygons visible
- [ ] Click markers shows popup
- [ ] Click map shows coordinates
- [ ] Copy button works
- [ ] Pan/zoom working
- [ ] No console errors

### Integration ✅
- [ ] Frontend calls backend API successfully
- [ ] Data flows: DB → Backend → Frontend
- [ ] Network requests visible in DevTools
- [ ] All requests return 200 status
- [ ] No CORS errors

---

## Troubleshooting During Testing

### "Connection refused" when starting backend
```powershell
# Make sure database is running
docker-compose ps
```

### "No module named 'app'" when running uvicorn
```powershell
# Make sure you're in backend directory
cd backend
uvicorn app.main:app --reload
```

### "No data on map"
1. Check backend is running: `http://localhost:8000/health`
2. Check seeding ran: `docker-compose logs -f`
3. Check browser console (F12 → Console)
4. Check Network tab for API errors

### Map shows but no data
1. Browser console (F12) should show no errors
2. Check API response: `curl http://localhost:8000/api/warehouses/`
3. Verify geometry format is GeoJSON

### "Cannot GET /api/warehouses"
1. Backend not running
2. Port 8000 already in use
3. Check backend logs

---

**✅ All tests passing = GeoSafe is ready for development!**

Next steps: Feature development, testing in production, user feedback gathering.
