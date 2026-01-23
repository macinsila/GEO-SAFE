"""
GeoSafe SQLite Seeding Script
Simple data seeding without PostGIS - uses JSON for coordinates
"""

import json
from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import declarative_base, sessionmaker

# Define base
Base = declarative_base()

# Simplified models without PostGIS
class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    address = Column(String(500), nullable=True)
    capacity = Column(Integer, nullable=True)
    status = Column(String(50), default="active")
    data = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class SafeZone(Base):
    __tablename__ = "safe_zones"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    capacity = Column(Integer, nullable=True)
    capacity_type = Column(String(50), default="persons")
    status = Column(String(50), default="active")
    data = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    unit = Column(String(50), nullable=True)
    category = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class WarehouseInventory(Base):
    __tablename__ = "warehouse_inventory"
    id = Column(Integer, primary_key=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

DATABASE_URL = "sqlite:///./geosafe.db"

def seed_database():
    """Seed SQLite database with sample data."""
    
    engine = create_engine(DATABASE_URL, echo=False)
    Base.metadata.create_all(engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("\n🏪 Creating Warehouses...")
        
        warehouses_data = [
            {
                "name": "Kadıköy Central Warehouse",
                "address": "Bahariye Cad. 45, Kadıköy, İstanbul",
                "capacity": 5000,
                "status": "active",
                "data": json.dumps({
                    "manager": "Ahmet Yılmaz",
                    "phone": "+90 216 123 4567",
                    "operating_hours": "09:00-18:00",
                    "location": {"lon": 29.0230, "lat": 40.9910},
                    "equipment": ["forklift", "shelving units"]
                }),
            },
            {
                "name": "Besiktas Supply Hub",
                "address": "Barbaros Bulvari 120, Besiktas, Istanbul",
                "capacity": 8000,
                "status": "active",
                "data": json.dumps({
                    "manager": "Fatih Kara",
                    "phone": "+90 212 345 6789",
                    "operating_hours": "08:00-20:00",
                    "location": {"lon": 29.0010, "lat": 41.0430},
                    "equipment": ["loading dock", "temperature control"]
                }),
            },
            {
                "name": "Moda Emergency Cache",
                "address": "Moda Cad. 78, Kadikoy, Istanbul",
                "capacity": 3000,
                "status": "active",
                "data": json.dumps({
                    "manager": "Zeynep Demir",
                    "phone": "+90 216 987 6543",
                    "operating_hours": "24/7",
                    "location": {"lon": 29.0320, "lat": 40.9850},
                    "equipment": ["backup generator", "medical supplies area"]
                }),
            },
            {
                "name": "Ortakoy Relief Center",
                "address": "Ortakoy Mahallesi, Besiktas, Istanbul",
                "capacity": 4500,
                "status": "active",
                "data": json.dumps({
                    "manager": "Ibrahim Yildiz",
                    "phone": "+90 212 456 7890",
                    "operating_hours": "07:00-19:00",
                    "location": {"lon": 29.0145, "lat": 41.0520},
                    "equipment": ["sorting area", "packaging station"]
                }),
            },
            {
                "name": "Fenerbahce Storage Depot",
                "address": "Fenerbahce Mahallesi, Kadikoy, Istanbul",
                "capacity": 6000,
                "status": "active",
                "data": json.dumps({
                    "manager": "Leyla Ozdemir",
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
            metadata = json.loads(wh_data["data"])
            loc = metadata.get("location", {})
            print(f"  ✓ {warehouse.name} ({loc.get('lat', 0):.4f}, {loc.get('lon', 0):.4f})")
        
        session.flush()
        
        print("\n🛡️  Creating Safe Zones...")
        
        safe_zones_data = [
            {
                "name": "Kadikoy Central Safe Zone",
                "capacity": 5000,
                "status": "verified",
                "data": json.dumps({
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
                "name": "Besiktas Coastal Safe Zone",
                "capacity": 8000,
                "status": "verified",
                "data": json.dumps({
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
                "name": "Moda-Yeldegirmeni Safe Corridor",
                "capacity": 3500,
                "status": "pending_verification",
                "data": json.dumps({
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
            print(f"  ✓ {safe_zone.name} (capacity: {safe_zone.capacity})")
        
        session.flush()
        
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
        
        session.flush()
        
        print("\n🏗️  Creating Warehouse Inventory...")
        
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
        
        inv_count = 0
        for warehouse, items_list in inventory_mapping:
            for item, quantity in items_list:
                inventory = WarehouseInventory(
                    warehouse_id=warehouse.id,
                    item_id=item.id,
                    quantity=quantity
                )
                session.add(inventory)
                inv_count += 1
        
        print(f"  ✓ Created {inv_count} inventory records")
        
        print("\n💾 Committing to database...")
        session.commit()
        
        print("\n✅ SQLite Database seeded successfully!")
        print(f"\n📊 Summary:")
        print(f"   • {len(created_warehouses)} warehouses created")
        print(f"   • {len(created_safe_zones)} safe zones created")
        print(f"   • {len(created_items)} supply items created")
        print(f"   • {inv_count} inventory links created")
        print(f"\n💾 Database file: geosafe.db")
        
    except Exception as e:
        print(f"\n❌ Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    print("=" * 70)
    print("🚀 GeoSafe SQLite Database Seeding Script")
    print("=" * 70)
    
    seed_database()
    
    print("\n" + "=" * 70)
    print("✨ Seeding complete! Your SQLite database is ready.")
    print("=" * 70)
