# GeoSafe Frontend README

## 📍 GeoSafe Frontend

A modern React application for visualizing disaster-safe zones and logistics warehouses on an interactive map.

### 🛠 Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Leaflet + React-Leaflet** - Interactive mapping
- **Axios** - HTTP client for backend calls
- **CSS3** - Responsive styling

### 📁 Project Structure

```
src/
├── components/          # React components
│   └── Map.tsx         # Leaflet map with data visualization
├── services/           # API layer
│   └── api.ts          # Backend communication
├── types/              # TypeScript interfaces
│   └── index.ts        # Data models
├── styles/             # CSS files
│   └── App.css         # Main stylesheet
├── App.tsx             # Main component
└── index.tsx           # Entry point
```

### 🚀 Getting Started

1. **Copy environment variables:**
   ```bash
   cp .env.example .env.local
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start development server:**
   ```bash
   npm start
   # or
   yarn start
   ```

   The app will open at `http://localhost:3000`

4. **Backend API must be running:**
   ```bash
   # From project root, in another terminal:
   docker-compose up
   ```

### 🗺 Features

- **Interactive Map**: OpenStreetMap with Leaflet
- **Warehouse Markers**: Blue pins showing logistics depots
- **Safe Zones**: Orange polygons showing safe gathering areas
- **Click Coordinates**: Click anywhere on the map to get lat/lng
- **Real-time Data**: Fetches warehouses and safe zones from backend API
- **Responsive Design**: Mobile-friendly UI

### 📊 Key Components

#### Map Component (`src/components/Map.tsx`)
- Renders Leaflet map with OpenStreetMap tiles
- Fetches warehouses and safe zones from backend
- Displays warehouses as markers
- Displays safe zones as colored polygons
- Handles map click events to capture coordinates

#### API Service (`src/services/api.ts`)
- Singleton pattern for consistent API access
- Methods: `fetchWarehouses()`, `fetchSafeZones()`, `healthCheck()`
- Centralized error handling and logging

#### Types (`src/types/index.ts`)
- `Warehouse`: Warehouse entity with Point geometry
- `SafeZone`: Safe zone entity with Polygon geometry
- `MapClickEvent`: Click event with coordinates and timestamp

### 🎯 Understanding the Data Flow

1. **App Component Mounts** → `useEffect` in Map component triggers
2. **Fetch Data** → API service calls backend endpoints
3. **Display on Map** → Warehouses as markers, safe zones as GeoJSON
4. **User Interaction** → Click map → `MapClickHandler` captures event
5. **Show Coordinates** → Display panel updates with lat/lng

### 📚 GeoJSON Format

Our backend returns geospatial data in GeoJSON format:

**Point (Warehouse):**
```json
{
  "type": "Point",
  "coordinates": [28.9784, 41.0082]  // [longitude, latitude]
}
```

**Polygon (Safe Zone):**
```json
{
  "type": "Polygon",
  "coordinates": [[[28.97, 41.00], [28.98, 41.00], [28.98, 41.01], [28.97, 41.01], [28.97, 41.00]]]
}
```

### 🐛 Troubleshooting

**"Cannot GET /api/v1/warehouses"**
- Make sure backend is running: `docker-compose up`
- Check REACT_APP_API_BASE_URL in `.env.local`

**Map not displaying**
- Check browser console for errors (F12)
- Verify Leaflet CSS is loaded (leaflet/dist/leaflet.css)

**No data on map**
- Check if backend has data (visit `http://localhost:8000/api/v1/warehouses`)
- Check browser Network tab for API calls

### 📝 Environment Variables

- `REACT_APP_API_BASE_URL`: Backend API URL (default: http://localhost:8000)
- `REACT_APP_MAP_CENTER_LAT`: Default map latitude (default: 41.0082)
- `REACT_APP_MAP_CENTER_LNG`: Default map longitude (default: 28.9784)
- `REACT_APP_MAP_DEFAULT_ZOOM`: Default zoom level (default: 12)

### 🔗 API Endpoints Used

- `GET /api/v1/warehouses` - List public warehouse summaries
- `GET /api/v1/safe-zones` - List public safe zone summaries
- `GET /health` - Backend health check

### 📦 Build for Production

```bash
npm run build
npm test -- --watchAll=false
```

Creates optimized production build in `build/` folder.
