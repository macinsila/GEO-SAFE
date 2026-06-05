"""
GeoSafe SQLite Seeding Script.

DEPRECATED — use scripts/seed.py --mode sqlite instead (GS-090).
This file is kept for reference only.
"""

import asyncio
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import json

# Import models - we'll only use the non-geometry parts
from app.models.warehouse import Warehouse
from app.models.safe_zone import SafeZone
from app.models.item import Item
from app.models.warehouse_inventory import WarehouseInventory

# SQLite database
DATABASE_URL = "sqlite+aiosqlite:///./geosafe.db"

print(f"📦 Connecting to SQLite: {DATABASE_URL}")


async def seed_database():
    """Seed SQLite database with sample data."""
    
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
    )
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        # Create tables
        async with engine.begin() as conn:
            from app.models.base import Base
            await conn.run_sync(Base.metadata.create_all)
        
        async with async_session() as session:
            print("\n🏪 Creating Warehouses...")
            
            # Warehouse data (without geometry for SQLite)
            warehouses_data = [
                {
                    "name": "Kadıköy Central Warehouse",
                    "address": "Bahariye Cad. 45, Kadıköy, İstanbul",
                    "capacity": 5000,
                    "status": "active",
                    "metadata": json.dumps({
                        "manager": "Ahmet Yılmaz",
                        "phone": "+90 216 123 4567",
                        "operating_hours": "09:00-18:00",
                        "location": {"lon": 29.0230, "lat": 40.9910},
                        "equipment": ["forklift", "shelving units"]
                    }),
                },
                {
                    "name": "Beşiktaş Supply Hub",
                    "address": "Barbaros Bulvarı 120, Beşiktaş, İstanbul",
                    "capacity": 8000,
                    "status": "active",
                    "metadata": json.dumps({
                        "manager": "Fatih Kara",
                        "phone": "+90 212 345 6789",
                        "operating_hours": "08:00-20:00",
                        "location": {"lon": 29.0010, "lat": 41.0430},
                        "equipment": ["loading dock", "temperature control"]
                    }),
                },
                {
                    "name": "Moda Emergency Cache",
                    "address": "Moda Cad. 78, Kadıköy, İstanbul",
                    "capacity": 3000,
                    "status": "active",
                    "metadata": json.dumps({
                        "manager": "Zeynep Demir",
                        "phone": "+90 216 987 6543",
                        "operating_hours": "24/7",
                        "location": {"lon": 29.0320, "lat": 40.9850},
                        "equipment": ["backup generator", "medical supplies area"]
                    }),
                },
                {
                    "name": "Ortaköy Relief Center",
                    "address": "Ortaköy Mahallesi, Beşiktaş, İstanbul",
                    "capacity": 4500,
                    "status": "active",
                    "metadata": json.dumps({
                        "manager": "İbrahim Yıldız",
                        "phone": "+90 212 456 7890",
                        "operating_hours": "07:00-19:00",
                        "location": {"lon": 29.0145, "lat": 41.0520},
                        "equipment": ["sorting area", "packaging station"]
                    }),
                },
                {
                    "name": "Fenerbahçe Storage Depot",
                    "address": "Fenerbahçe Mahallesi, Kadıköy, İstanbul",
                    "capacity": 6000,
                    "status": "active",
                    "metadata": json.dumps({
                        "manager": "Leyla Özdemir",
                        "phone": "+90 216 654 3210",
                        "operating_hours": "08:00-17:00",
                        "location": {"lon": 29.0450, "lat": 40.9750},
                        "equipment": ["climate control", "inventory system"]
                    }),
                },
            ]
            
            created_warehouses = []
            for wh_data in warehouses_data:
                warehouse = Warehouse(**wh_data)
                session.add(warehouse)
                created_warehouses.append(warehouse)
                metadata = json.loads(wh_data["metadata"])
                loc = metadata.get("location", {})
                print(f"  ✓ {warehouse.name} ({loc.get('lat', 0):.4f}°, {loc.get('lon', 0):.4f}°)")
            
            await session.flush()
            
            print("\n🛡️  Creating Safe Zones...")
            
            safe_zones_data = [
                {
                    "name": "Kadıköy Central Safe Zone",
                    "capacity": 5000,
                    "status": "verified",
                    "metadata": json.dumps({
                        "type": "public_park",
                        "bounds": {
                            "minLon": 29.0150, "maxLon": 29.0350,
                            "minLat": 40.9800, "maxLat": 41.0000
                        },
                        "facilities": ["water source", "shelter", "medical tent"],
                        "last_verified": "2024-12-20"
                    }),
                },
                {
                    "name": "Beşiktaş Coastal Safe Zone",
                    "capacity": 8000,
                    "status": "verified",
                    "metadata": json.dumps({
                        "type": "beachfront",
                        "bounds": {
                            "minLon": 28.9900, "maxLon": 29.0200,
                            "minLat": 41.0350, "maxLat": 41.0600
                        },
                        "facilities": ["open space", "fresh water station", "evacuation route"],
                        "last_verified": "2024-12-22"
                    }),
                },
                {
                    "name": "Moda-Yeldeğirmeni Safe Corridor",
                    "capacity": 3500,
                    "status": "pending_verification",
                    "metadata": json.dumps({
                        "type": "street_corridor",
                        "bounds": {
                            "minLon": 29.0200, "maxLon": 29.0550,
                            "minLat": 40.9700, "maxLat": 40.9950
                        },
                        "facilities": ["clear path", "checkpoints"],
                        "last_verified": "2024-12-18"
                    }),
                },
            ]
            
            created_safe_zones = []
            for sz_data in safe_zones_data:
                safe_zone = SafeZone(**sz_data)
                session.add(safe_zone)
                created_safe_zones.append(safe_zone)
                metadata = json.loads(sz_data["metadata"])
                bounds = metadata.get("bounds", {})
                print(f"  ✓ {safe_zone.name} (capacity: {safe_zone.capacity})")
                print(f"    → Bounds: {bounds}")
            
            await session.flush()
            
            print("\n📦 Creating Supply Items...")
            
            items_data = [
                {"name": "Blanket", "unit": "piece", "category": "shelter"},
                {"name": "Water (liter)", "unit": "liter", "category": "hydration"},
                {"name": "Medical Kit", "unit": "piece", "category": "medical"},
                {"name": "Food Package", "unit": "box", "category": "food"},
                {"name": "Tent", "unit": "piece", "category": "shelter"},
                {"name": "First Aid Supplies", "unit": "pack", "category": "medical"},
            ]
            
            created_items = []
            for item_data in items_data:
                item = Item(**item_data)
                session.add(item)
                created_items.append(item)
                print(f"  ✓ {item.name} ({item.unit})")
            
            await session.flush()
            
            print("\n📊 Creating Warehouse Inventory...")
            
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
            
            print("\n✅ SQLite Database seeded successfully!")
            print(f"\n📊 Summary:")
            print(f"   • {len(created_warehouses)} warehouses created")
            print(f"   • {len(created_safe_zones)} safe zones created")
            print(f"   • {len(created_items)} supply items created")
            print(f"   • Inventory links created")
            print(f"\n📁 Database file: geosafe.db")
            
    except Exception as e:
        print(f"\n❌ Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    print("=" * 70)
    print("🌍 GeoSafe SQLite Database Seeding Script")
    print("=" * 70)
    
    asyncio.run(seed_database())
    
    print("\n" + "=" * 70)
    print("✨ Seeding complete! Your SQLite database is ready.")
    print("=" * 70)
