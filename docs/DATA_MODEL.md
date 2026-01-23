# 📊 GeoSafe Data Model & Architecture Guide

## ER Diagram (Text Format)

```
┌─────────────────────────────────────────────────────────────────┐
│                         GEOSAFE DATABASE                         │
└─────────────────────────────────────────────────────────────────┘

                             ┌─────────────┐
                             │    USERS    │
                             ├─────────────┤
                             │ id (PK)     │
                             │ name        │
                             │ email (UQ)  │
                             │ role        │
                             │ password    │
                             │ created_at  │
                             └─────────────┘
                                    △
                                    │ 1
                                    │
                          (performed_by)
                                    │ *
                             ┌──────┴─────────┐
                             │                 │
                    ┌────────────────┐  ┌──────────────────┐
                    │  WAREHOUSES    │  │ INVENTORY_       │
                    ├────────────────┤  │ MOVEMENTS        │
                    │ id (PK)        │  ├──────────────────┤
                    │ name           │  │ id (PK)          │
                    │ location       │◄─┼─from_warehouse_id│
                    │ (Point)        │  │ to_warehouse_id  │
      ┌─────────────┤ address        │  │ item_id (FK)     │
      │             │ capacity       │  │ quantity         │
      │             │ status         │  │ movement_type    │
      │             │ metadata       │  │ timestamp        │
      │             │ created_at     │  │ metadata         │
      │             └────────────────┘  └──────────────────┘
      │                    △                       △
      │                    │ *                     │ *
      │                    │                       │
      │ (warehouse_id)     (warehouse_id)      (item_id)
      │ *                  *                       │ 1
      │                                            │
      │             ┌──────────────────┐           │
      │             │ WAREHOUSE_       │           │
      │             │ INVENTORY        │           │
      │             ├──────────────────┤           │
      │             │ id (PK)          │           │
      │             │ warehouse_id(FK) ├───────────┼──────────┐
      │             │ item_id (FK)     │───────────┘          │
      │             │ quantity         │                      │
      │             │ last_updated     │                      │
      │             └──────────────────┘                      │
      │                                                       │
      │                                    ┌──────────────┐   │
      │                                    │    ITEMS     │   │
      │                                    ├──────────────┤   │
      │                                    │ id (PK)      │◄──┘
      │                                    │ sku (UQ)     │
      │                                    │ name         │
      │                                    │ description  │
      │                                    │ unit         │
      │                                    │ created_at   │
      │                                    └──────────────┘
      │
      └────────────────────────────────────────────────┐
                                                       │
                              ┌────────────────────┐   │
                              │  SAFE_ZONES        │   │
                              ├────────────────────┤   │
                              │ id (PK)            │   │
                              │ name               │   │
                              │ geometry (Polygon) │   │
                              │ capacity           │   │
                              │ capacity_type      │   │
                              │ status             │   │
                              │ metadata           │   │
                              │ created_at         │   │
                              └────────────────────┘   │
                                                       │
                              (Indirect relation      │
                               through geography)     │
                                                       │
                              ┌────────────────────┐   │
                              │  ALERT_ZONES       │   │
                              ├────────────────────┤   │
                              │ id (PK)            │   │
                              │ type               │◄──┘
                              │ geometry           │
                              │ message            │
                              │ severity           │
                              │ created_at         │
                              └────────────────────┘

Legend:
  PK = Primary Key (unique identifier)
  FK = Foreign Key (reference to another table)
  UQ = Unique constraint
  │  = Relationship
  △  = Parent table
  ◄─ = One-to-many relationship
  *  = Many side
  1  = One side
```

---

## Data Model Relationships

### 1. Users → Inventory Movements
**Relationship:** One User can perform many Inventory Movements
- **Type:** One-to-Many
- **Purpose:** Track who performed each inventory change
- **Example:** Admin "Ahmet Yılmaz" creates 5 supply movements

### 2. Warehouses → Warehouse Inventory
**Relationship:** One Warehouse stores many Items
- **Type:** One-to-Many (through junction table)
- **Purpose:** Track stock at each warehouse
- **Example:** Beyoğlu warehouse has 100 boxes of food, 50 liters of water

### 3. Items → Warehouse Inventory
**Relationship:** One Item is stored in many Warehouses
- **Type:** Many-to-Many (through junction table)
- **Purpose:** Track which items are at which locations
- **Example:** Food (item) is in Beyoğlu, Fatih, and Şişli warehouses

### 4. Warehouses → Inventory Movements
**Relationship:** One Warehouse can be source/destination of many movements
- **Type:** One-to-Many (two foreign keys)
- **Purpose:** Track inventory flow
- **Example:** Transfer 50 boxes from Beyoğlu to Fatih warehouse

### 5. Safe Zones (Standalone with geography)
**Relationship:** Independent polygons for disaster response
- **Type:** One-to-Many (geographically contains people/supplies)
- **Purpose:** Define safe gathering areas
- **Example:** Taksim Square covers area from (28.975, 41.006) to (28.982, 41.011)

---

## PostGIS Geometry Types

### Point Geometry (Warehouses)

```
┌─────────────────────────────────────┐
│ Warehouse Location as Point         │
├─────────────────────────────────────┤
│ Type: geometry(Point, 4326)         │
│ Format: POINT(lon lat)              │
│ Example: POINT(28.9784 41.0082)     │
│                                      │
│ ◆ = Single coordinate point         │
│                                      │
│ GeoJSON:                            │
│ {                                   │
│   "type": "Point",                 │
│   "coordinates": [28.9784, 41.0082]│
│ }                                   │
└─────────────────────────────────────┘
```

### Polygon Geometry (Safe Zones)

```
┌──────────────────────────────────────────────────────────┐
│ Safe Zone Boundary as Polygon                            │
├──────────────────────────────────────────────────────────┤
│ Type: geometry(Polygon, 4326)                            │
│ Format: POLYGON((lon lat, lon lat, ... close ring))     │
│ Example:                                                  │
│   POLYGON((                                              │
│     28.975 41.006,                                       │
│     28.982 41.006,                                       │
│     28.982 41.011,                                       │
│     28.975 41.011,                                       │
│     28.975 41.006   ← closes the ring                    │
│   ))                                                      │
│                                                           │
│ Visualization:                                            │
│   (28.975,41.011) ┌─────────────────┐ (28.982,41.011)  │
│                   │                 │                   │
│      Safe Zone    │      ◇           │                   │
│                   │   (center)       │                   │
│                   │                 │                   │
│   (28.975,41.006)└─────────────────┘(28.982,41.006)   │
│                                                           │
│ GeoJSON:                                                 │
│ {                                                        │
│   "type": "Polygon",                                    │
│   "coordinates": [[                                      │
│     [28.975, 41.006],                                   │
│     [28.982, 41.006],                                   │
│     [28.982, 41.011],                                   │
│     [28.975, 41.011],                                   │
│     [28.975, 41.006]                                    │
│   ]]                                                     │
│ }                                                        │
└──────────────────────────────────────────────────────────┘
```

---

## SRID 4326 Explained

**SRID** = Spatial Reference ID

**4326** = WGS84 (World Geodetic System 1984)
- Standard latitude/longitude system
- Used globally by GPS, maps, etc.
- Coordinates: [longitude, latitude]

```
SRID:4326 Map View:

90° N ─────────────────────────────── (North Pole)
      │
      │         ◆ Istanbul
      │         (28.9784, 41.0082)
      ◆─────────────────────────────◆
      Istanbul                   Ankara
      (28.97, 41.00)            (32.85, 39.93)
      │                              │
  0° E└──────────────────────────────┘180° E
      (Prime Meridian)
      │
      │
-90° S ─────────────────────────────── (South Pole)

Longitude: -180° (West) to +180° (East)
Latitude: -90° (South) to +90° (North)

Istanbul: Lon 28.9784° E, Lat 41.0082° N
Ankara: Lon 32.8537° E, Lat 39.9334° N
```

---

## Sample Data Flow

### Scenario: Record Supply Movement

```
┌────────────────────────────────────────────────────────────┐
│ User: Zeynep (Admin) moves 100 food boxes                  │
│ From: Fatih warehouse                                       │
│ To: Beyoğlu warehouse                                       │
│ Reason: Beyoğlu has higher demand                          │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────┐
    │ SQL INSERT INTO inventory_movements │
    ├─────────────────────────────────────┤
    │ item_id = 1 (FOOD-001)              │
    │ quantity = -100                     │
    │ from_warehouse_id = 2 (Fatih)       │
    │ to_warehouse_id = 1 (Beyoğlu)       │
    │ movement_type = 'transfer'          │
    │ performed_by = 2 (Zeynep)           │
    │ timestamp = 2025-12-24 15:30:00     │
    └─────────────────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────┐
    │ UPDATE warehouse_inventory          │
    │ WHERE warehouse_id=2 AND item_id=1  │
    │ SET quantity = quantity - 100       │
    │                                     │
    │ UPDATE warehouse_inventory          │
    │ WHERE warehouse_id=1 AND item_id=1  │
    │ SET quantity = quantity + 100       │
    └─────────────────────────────────────┘
                          │
                          ▼
    Frontend receives updated data
    and reflects changes on UI
```

---

## API Response Examples

### Warehouse (Point Geometry)

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

**SQL Query Behind the Scenes:**
```sql
SELECT 
  id,
  name,
  ST_AsGeoJSON(location) as location,
  address,
  capacity,
  status,
  created_at
FROM warehouses
WHERE id = 1;
```

### Safe Zone (Polygon Geometry)

```json
{
  "id": 1,
  "name": "Taksim Square Safe Zone",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [28.975, 41.006],
        [28.982, 41.006],
        [28.982, 41.011],
        [28.975, 41.011],
        [28.975, 41.006]
      ]
    ]
  },
  "capacity": 2000,
  "capacity_type": "persons",
  "status": "active",
  "created_at": "2025-12-24T12:00:00"
}
```

**SQL Query Behind the Scenes:**
```sql
SELECT 
  id,
  name,
  ST_AsGeoJSON(geometry) as geometry,
  capacity,
  capacity_type,
  status,
  created_at
FROM safe_zones
WHERE id = 1;
```

---

## Database Indexing Strategy

### Why Indexes Matter
Indexes make queries faster by creating a "lookup table":

```
Without Index:
  Search for warehouse by id
  ❌ Read all 5 rows sequentially

With Index (B-tree):
  id:1 → row #0
  id:2 → row #1
  id:3 → row #2
  ✅ Jump directly to row using index
```

### Indexes in GeoSafe

```sql
-- Primary keys (automatic)
PRIMARY KEY (id)

-- Spatial indexes (for PostGIS queries)
CREATE INDEX warehouses_location_gist ON warehouses USING GIST(location);
CREATE INDEX safe_zones_geometry_gist ON safe_zones USING GIST(geometry);

-- Regular indexes (for frequent lookups)
CREATE INDEX idx_warehouse_id ON warehouse_inventory(warehouse_id);
CREATE INDEX idx_item_id ON warehouse_inventory(item_id);
CREATE INDEX idx_user_id ON inventory_movements(performed_by);

-- Unique indexes (prevent duplicates)
CREATE UNIQUE INDEX idx_warehouse_name ON warehouses(name);
CREATE UNIQUE INDEX idx_item_sku ON items(sku);
```

**GIST Index**: Generalized Search Tree - optimized for spatial (geometry) searches
- Much faster than regular B-tree for PostGIS queries
- Required for efficient distance/containment queries

---

## Normalization

GeoSafe follows **Database Normalization** principles:

### 1st Normal Form (1NF)
✅ All values are atomic (not lists)
```sql
-- ✓ Good: Each item in separate row
SELECT * FROM warehouse_inventory;
-- id | warehouse_id | item_id | quantity

-- ✗ Bad: Multiple items in one column
-- warehouse_id | items_list (would be "food,water,medicine")
```

### 2nd Normal Form (2NF)
✅ No partial dependencies
```sql
-- ✓ Good: inventory linked to both warehouse AND item
CREATE TABLE warehouse_inventory (
  warehouse_id INT,    -- Full dependency
  item_id INT,         -- Full dependency
  quantity INT
);

-- ✗ Bad: Item name in warehouse table
-- CREATE TABLE warehouses (
--   id, name, location, item_name, quantity
-- );
```

### 3rd Normal Form (3NF)
✅ No transitive dependencies
```sql
-- ✓ Good: User info separate from movements
CREATE TABLE inventory_movements (
  id, item_id, from_warehouse_id, performed_by
);
CREATE TABLE users (
  id, name, email, role
);

-- ✗ Bad: User details in movements table
-- CREATE TABLE inventory_movements (
--   id, item_id, performed_by_name, performed_by_email, ...
-- );
```

---

## Key Concepts for Students

### What is a Foreign Key?

A **Foreign Key** links tables together:

```sql
-- inventory_movements references warehouses
CREATE TABLE inventory_movements (
  id INT PRIMARY KEY,
  from_warehouse_id INT,
  FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id)
);

-- This ensures:
-- ✓ You can only reference existing warehouses
-- ✗ You cannot delete a warehouse that has movements
-- ✓ Database maintains data consistency
```

### What is a Primary Key?

A **Primary Key** uniquely identifies a row:

```sql
CREATE TABLE warehouses (
  id INT PRIMARY KEY,     -- ← Each warehouse has unique ID
  name VARCHAR(255),      -- ← Can be duplicated
  location GEOMETRY       -- ← Can be duplicated
);

-- id=1 is unique (only one Beyoğlu warehouse)
-- But name="warehouse" could appear multiple times
```

### What is a Unique Constraint?

A **Unique Constraint** ensures no duplicates:

```sql
CREATE TABLE items (
  id INT PRIMARY KEY,
  sku VARCHAR(100) UNIQUE,  -- ← No two items with same SKU
  name VARCHAR(255)         -- ← Can be duplicated
);

-- sku="FOOD-001" appears only once
-- But name="Food" could appear multiple times
```

---

## Performance Considerations

### Slow Query Example

```sql
-- ✗ SLOW: No index, scans all safe_zones
SELECT * FROM safe_zones
WHERE name LIKE 'Taksim%';

-- ✓ FAST: With index on name
CREATE INDEX idx_safe_zone_name ON safe_zones(name);
```

### Spatial Query Optimization

```sql
-- ✗ SLOW: Linear distance calculation (slow for many rows)
SELECT *, distance(location, point)
FROM warehouses
ORDER BY distance
LIMIT 5;

-- ✓ FAST: Uses GIST index
CREATE INDEX warehouses_location_gist ON warehouses USING GIST(location);

SELECT *, ST_DistanceSphere(location, point) as distance
FROM warehouses
ORDER BY ST_DistanceSphere(location, point)
LIMIT 5;
```

---

**Understanding this data model will help you:**
- ✅ Write better SQL queries
- ✅ Avoid data corruption
- ✅ Optimize performance
- ✅ Design new features correctly
- ✅ Debug issues faster

**Next Step:** Explore sample queries in `scripts/README.md` or PostgreSQL documentation.
