"""
GeoSafe Database Seeding Script
Populates the database with sample warehouses and safe zones
in Istanbul (Kadıköy and Beşiktaş regions).

Usage:
  python seed_db.py
  
Prerequisites:
  - PostgreSQL running with PostGIS extension
  - Database created and migrated with Alembic
  - Environment variables set (DATABASE_URL)
"""

import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from geoalchemy2.elements import WKTElement
from shapely.geometry import Point, Polygon

# Import models
from app.models.warehouse import Warehouse
from app.models.safe_zone import SafeZone
from app.models.item import Item
from app.models.warehouse_inventory import WarehouseInventory


# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe_db"
)

print(f"📦 Connecting to database: {DATABASE_URL}")


# ============================================================================
# SAMPLE DATA: Istanbul neighborhoods (Kadıköy and Beşiktaş)
# ============================================================================

SAMPLE_WAREHOUSES = [
    {
        "name": "Kadıköy Central Warehouse",
        "location": (29.0230, 40.9910),  # (lon, lat)
        "address": "Bahariye Cad. 45, Kadıköy, İstanbul",
        "capacity": 5000,
        "status": "active",
        "metadata": {
            "manager": "Ahmet Yılmaz",
            "phone": "+90 216 123 4567",
            "operating_hours": "09:00-18:00",
            "equipment": ["forklift", "shelving units"]
        },
    },
    {
        "name": "Beşiktaş Supply Hub",
        "location": (29.0010, 41.0430),  # (lon, lat)
        "address": "Barbaros Bulvarı 120, Beşiktaş, İstanbul",
        "capacity": 8000,
        "status": "active",
        "metadata": {
            "manager": "Fatih Kara",
            "phone": "+90 212 345 6789",
            "operating_hours": "08:00-20:00",
            "equipment": ["loading dock", "temperature control"]
        },
    },
    {
        "name": "Moda Emergency Cache",
        "location": (29.0320, 40.9850),  # (lon, lat)
        "address": "Moda Cad. 78, Kadıköy, İstanbul",
        "capacity": 3000,
        "status": "active",
        "metadata": {
            "manager": "Zeynep Demir",
            "phone": "+90 216 987 6543",
            "operating_hours": "24/7",
            "equipment": ["backup generator", "medical supplies area"]
        },
    },
    {
        "name": "Ortaköy Relief Center",
        "location": (29.0145, 41.0520),  # (lon, lat)
        "address": "Ortaköy Mahallesi, Beşiktaş, İstanbul",
        "capacity": 4500,
        "status": "active",
        "metadata": {
            "manager": "İbrahim Yıldız",
            "phone": "+90 212 456 7890",
            "operating_hours": "07:00-19:00",
            "equipment": ["sorting area", "packaging station"]
        },
    },
    {
        "name": "Fenerbahçe Storage Depot",
        "location": (29.0450, 40.9750),  # (lon, lat)
        "address": "Fenerbahçe Mahallesi, Kadıköy, İstanbul",
        "capacity": 6000,
        "status": "active",
        "metadata": {
            "manager": "Leyla Özdemir",
            "phone": "+90 216 654 3210",
            "operating_hours": "08:00-17:00",
            "equipment": ["climate control", "inventory system"]
        },
    },
]

# Safe zones are Polygon geometries covering neighborhood areas
SAMPLE_SAFE_ZONES = [
    {
        "name": "Kadıköy Central Safe Zone",
        "capacity": 5000,
        "status": "verified",
        "geometry": Polygon([
            (29.0150, 40.9800),
            (29.0350, 40.9800),
            (29.0350, 41.0000),
            (29.0150, 41.0000),
            (29.0150, 40.9800),
        ]),
        "metadata": {
            "type": "public_park",
            "facilities": ["water source", "shelter", "medical tent"],
            "last_verified": "2024-12-20"
        }
    },
    {
        "name": "Beşiktaş Coastal Safe Zone",
        "capacity": 8000,
        "status": "verified",
        "geometry": Polygon([
            (28.9900, 41.0350),
            (29.0200, 41.0350),
            (29.0200, 41.0600),
            (28.9900, 41.0600),
            (28.9900, 41.0350),
        ]),
        "metadata": {
            "type": "beachfront",
            "facilities": ["open space", "fresh water station", "evacuation route"],
            "last_verified": "2024-12-22"
        }
    },
    {
        "name": "Moda-Yeldeğirmeni Safe Corridor",
        "capacity": 3500,
        "status": "pending_verification",
        "geometry": Polygon([
            (29.0200, 40.9700),
            (29.0550, 40.9700),
            (29.0550, 40.9950),
            (29.0200, 40.9950),
            (29.0200, 40.9700),
        ]),
        "metadata": {
            "type": "street_corridor",
            "facilities": ["clear path", "checkpoints"],
            "last_verified": "2024-12-18"
        }
    },
]

SAMPLE_ITEMS = [
    {"name": "Blanket", "unit": "piece", "category": "shelter"},
    {"name": "Water (liter)", "unit": "liter", "category": "hydration"},
    {"name": "Medical Kit", "unit": "piece", "category": "medical"},
    {"name": "Food Package", "unit": "box", "category": "food"},
    {"name": "Tent", "unit": "piece", "category": "shelter"},
    {"name": "First Aid Supplies", "unit": "pack", "category": "medical"},
]


# ============================================================================
# SEEDING FUNCTION
# ============================================================================

async def seed_database():
    """Seed database with sample Istanbul data."""
    
    # Create async engine
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
    )
    
    # Create session factory
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with async_session() as session:
            print("\n🏪 Creating Warehouses...")
            
            created_warehouses = []
            for wh_data in SAMPLE_WAREHOUSES:
                lon, lat = wh_data.pop("location")
                location_point = Point(lon, lat)
                
                warehouse = Warehouse(
                    **wh_data,
                    location=WKTElement(location_point.wkt, srid=4326)
                )
                session.add(warehouse)
                created_warehouses.append(warehouse)
                print(f"  ✓ {warehouse.name} ({lat}°, {lon}°)")
            
            await session.flush()
            
            print("\n🛡️  Creating Safe Zones...")
            
            created_safe_zones = []
            for sz_data in SAMPLE_SAFE_ZONES:
                geometry_polygon = sz_data.pop("geometry")
                
                safe_zone = SafeZone(
                    **sz_data,
                    geometry=WKTElement(geometry_polygon.wkt, srid=4326)
                )
                session.add(safe_zone)
                created_safe_zones.append(safe_zone)
            
            await session.flush()
            
            print("\n📦 Creating Supply Items...")
            
            created_items = []
            for item_data in SAMPLE_ITEMS:
                item = Item(**item_data)
                session.add(item)
                created_items.append(item)
                print(f"  ✓ {item.name} ({item.unit})")
            
            await session.flush()
            
            print("\n📊 Creating Warehouse Inventory...")
            
            # Link warehouses to items with quantities
            inventory_mapping = [
                (created_warehouses[0], [
                    (created_items[0], 500),
                    (created_items[1], 2000),
                    (created_items[2], 50),
                ]),
                (created_warehouses[1], [
                    (created_items[0], 800),
                    (created_items[1], 3000),
                    (created_items[2], 100),
                    (created_items[3], 400),
                    (created_items[4], 30),
                ]),
                (created_warehouses[2], [
                    (created_items[2], 150),
                    (created_items[5], 200),
                    (created_items[1], 500),
                ]),
                (created_warehouses[3], [
                    (created_items[0], 600),
                    (created_items[1], 2500),
                    (created_items[3], 300),
                    (created_items[4], 25),
                ]),
                (created_warehouses[4], [
                    (created_items[0], 700),
                    (created_items[1], 2200),
                    (created_items[2], 75),
                    (created_items[3], 350),
                ]),
            ]
            
            for warehouse, items_list in inventory_mapping:
                for item, quantity in items_list:
                    inventory = WarehouseInventory(
                        warehouse_id=warehouse.id,
                        item_id=item.id,
                        quantity=quantity
                    )
                    session.add(inventory)
                    print(f"  ✓ {warehouse.name} - {item.name}: {quantity} {item.unit}")
            
            print("\n💾 Committing to database...")
            await session.commit()
            
            print("\n✅ Database seeded successfully!")
            print(f"\n📊 Summary:")
            print(f"   • {len(created_warehouses)} warehouses created")
            print(f"   • {len(created_safe_zones)} safe zones created")
            print(f"   • {len(created_items)} supply items created")
            
    except Exception as e:
        print(f"\n❌ Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    print("=" * 70)
    print("🌍 GeoSafe Database Seeding Script")
    print("=" * 70)
    
    asyncio.run(seed_database())
    
    print("\n" + "=" * 70)
    print("✨ Seeding complete! Your database is ready to use.")
    print("=" * 70)
