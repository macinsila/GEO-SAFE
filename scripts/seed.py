"""
GeoSafe unified seed script — GS-090.

Supports both PostgreSQL+PostGIS and SQLite (for local/test environments).
Mode is detected automatically from DATABASE_URL, or forced with --mode.

Usage:
  python scripts/seed.py                  # auto-detect from DATABASE_URL
  python scripts/seed.py --mode postgres  # force PostgreSQL mode
  python scripts/seed.py --mode sqlite    # force SQLite mode (no geometry)

For PostgreSQL, set DATABASE_URL in .env or environment.
For SQLite, uses ./geosafe.db by default (or DATABASE_URL if set to sqlite).
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv

load_dotenv()

# ── Shared data ───────────────────────────────────────────────────────────────

WAREHOUSES = [
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
            "equipment": ["forklift", "shelving units"],
        },
    },
    {
        "name": "Beşiktaş Supply Hub",
        "location": (29.0010, 41.0430),
        "address": "Barbaros Bulvarı 120, Beşiktaş, İstanbul",
        "capacity": 8000,
        "status": "active",
        "metadata": {
            "manager": "Fatih Kara",
            "phone": "+90 212 345 6789",
            "operating_hours": "08:00-20:00",
            "equipment": ["loading dock", "temperature control"],
        },
    },
    {
        "name": "Moda Emergency Cache",
        "location": (29.0320, 40.9850),
        "address": "Moda Cad. 78, Kadıköy, İstanbul",
        "capacity": 3000,
        "status": "active",
        "metadata": {
            "manager": "Zeynep Demir",
            "phone": "+90 216 987 6543",
            "operating_hours": "24/7",
            "equipment": ["backup generator", "medical supplies area"],
        },
    },
    {
        "name": "Ortaköy Relief Center",
        "location": (29.0145, 41.0520),
        "address": "Ortaköy Mahallesi, Beşiktaş, İstanbul",
        "capacity": 4500,
        "status": "active",
        "metadata": {
            "manager": "İbrahim Yıldız",
            "phone": "+90 212 456 7890",
            "operating_hours": "07:00-19:00",
            "equipment": ["sorting area", "packaging station"],
        },
    },
    {
        "name": "Fenerbahçe Storage Depot",
        "location": (29.0450, 40.9750),
        "address": "Fenerbahçe Mahallesi, Kadıköy, İstanbul",
        "capacity": 6000,
        "status": "active",
        "metadata": {
            "manager": "Leyla Özdemir",
            "phone": "+90 216 654 3210",
            "operating_hours": "08:00-17:00",
            "equipment": ["climate control", "inventory system"],
        },
    },
]

SAFE_ZONES = [
    {
        "name": "Kadıköy Central Safe Zone",
        "capacity": 5000,
        "status": "verified",
        "bounds": {"minLon": 29.0150, "maxLon": 29.0350, "minLat": 40.9800, "maxLat": 41.0000},
        "metadata": {
            "type": "public_park",
            "facilities": ["water source", "shelter", "medical tent"],
            "last_verified": "2024-12-20",
        },
    },
    {
        "name": "Beşiktaş Coastal Safe Zone",
        "capacity": 8000,
        "status": "verified",
        "bounds": {"minLon": 28.9900, "maxLon": 29.0200, "minLat": 41.0350, "maxLat": 41.0600},
        "metadata": {
            "type": "beachfront",
            "facilities": ["open space", "fresh water station", "evacuation route"],
            "last_verified": "2024-12-22",
        },
    },
    {
        "name": "Moda-Yeldeğirmeni Safe Corridor",
        "capacity": 3500,
        "status": "pending_verification",
        "bounds": {"minLon": 29.0200, "maxLon": 29.0550, "minLat": 40.9700, "maxLat": 40.9950},
        "metadata": {
            "type": "street_corridor",
            "facilities": ["clear path", "checkpoints"],
            "last_verified": "2024-12-18",
        },
    },
]

ITEMS = [
    {"sku": "BLANKET-001", "name": "Blanket", "description": "Thermal emergency blanket.", "unit": "piece"},
    {"sku": "WATER-001", "name": "Water (liter)", "description": "Potable water supply.", "unit": "liter"},
    {"sku": "MEDKIT-001", "name": "Medical Kit", "description": "Basic medical kit for first response.", "unit": "piece"},
    {"sku": "FOOD-001", "name": "Food Package", "description": "Non-perishable emergency food.", "unit": "box"},
    {"sku": "TENT-001", "name": "Tent", "description": "Emergency shelter tent.", "unit": "piece"},
    {"sku": "FIRSTAID-001", "name": "First Aid Supplies", "description": "First aid refills and supplies.", "unit": "pack"},
]

# (warehouse_index, [(item_index, quantity), ...])
INVENTORY = [
    (0, [(0, 500), (1, 2000), (2, 50)]),
    (1, [(0, 800), (1, 3000), (2, 100), (3, 400), (4, 30)]),
    (2, [(2, 150), (5, 200), (1, 500)]),
    (3, [(0, 600), (1, 2500), (3, 300), (4, 25)]),
    (4, [(0, 700), (1, 2200), (2, 75), (3, 350)]),
]


# ── PostgreSQL mode (with PostGIS geometry) ───────────────────────────────────

async def _seed_postgres(db_url: str) -> None:
    from geoalchemy2.elements import WKTElement
    from shapely.geometry import Point, Polygon
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.models.item import Item
    from app.models.safe_zone import SafeZone
    from app.models.warehouse import Warehouse
    from app.models.warehouse_inventory import WarehouseInventory

    print(f"Connecting (PostgreSQL): {db_url}")
    engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with Session() as session:
            print("\nUpserting warehouses...")
            created_wh: list[Warehouse] = []
            for p in WAREHOUSES:
                r = await session.execute(select(Warehouse).where(Warehouse.name == p["name"]))
                wh = r.scalars().first() or Warehouse(name=p["name"])
                if wh not in session:
                    session.add(wh)
                lon, lat = p["location"]
                wh.location = WKTElement(Point(lon, lat).wkt, srid=4326)
                wh.address = p["address"]
                wh.capacity = p["capacity"]
                wh.status = p["status"]
                wh.data = p["metadata"]
                created_wh.append(wh)
                print(f"  ok {wh.name}")
            await session.flush()

            print("\nUpserting safe zones...")
            created_sz: list[SafeZone] = []
            for p in SAFE_ZONES:
                r = await session.execute(select(SafeZone).where(SafeZone.name == p["name"]))
                sz = r.scalars().first() or SafeZone(name=p["name"])
                if sz not in session:
                    session.add(sz)
                b = p["bounds"]
                poly = Polygon([
                    (b["minLon"], b["minLat"]), (b["maxLon"], b["minLat"]),
                    (b["maxLon"], b["maxLat"]), (b["minLon"], b["maxLat"]),
                    (b["minLon"], b["minLat"]),
                ])
                sz.geometry = WKTElement(poly.wkt, srid=4326)
                sz.capacity = p["capacity"]
                sz.status = p["status"]
                sz.data = {**p["metadata"], "bounds": b}
                created_sz.append(sz)
                print(f"  ok {sz.name}")
            await session.flush()

            print("\nUpserting items...")
            created_items: list[Item] = []
            for p in ITEMS:
                r = await session.execute(select(Item).where(Item.sku == p["sku"]))
                item = r.scalars().first() or Item(sku=p["sku"])
                if item not in session:
                    session.add(item)
                item.name = p["name"]
                item.description = p["description"]
                item.unit = p["unit"]
                created_items.append(item)
                print(f"  ok {item.sku}")
            await session.flush()

            print("\nUpserting inventory...")
            for wh_idx, items_list in INVENTORY:
                wh = created_wh[wh_idx]
                for item_idx, qty in items_list:
                    item = created_items[item_idx]
                    r = await session.execute(
                        select(WarehouseInventory).where(
                            WarehouseInventory.warehouse_id == wh.id,
                            WarehouseInventory.item_id == item.id,
                        )
                    )
                    inv = r.scalars().first() or WarehouseInventory(
                        warehouse_id=wh.id, item_id=item.id
                    )
                    if inv not in session:
                        session.add(inv)
                    inv.quantity = qty
                    print(f"  ok {wh.name} / {item.name} = {qty}")

            await session.commit()

        print(f"\nDone. {len(created_wh)} warehouses · {len(created_sz)} safe zones · {len(ITEMS)} items.")
    finally:
        await engine.dispose()


# ── SQLite mode (no geometry) ─────────────────────────────────────────────────

async def _seed_sqlite(db_url: str) -> None:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.models.base import Base
    from app.models.item import Item
    from app.models.safe_zone import SafeZone
    from app.models.warehouse import Warehouse
    from app.models.warehouse_inventory import WarehouseInventory

    print(f"Connecting (SQLite): {db_url}")
    engine = create_async_engine(db_url, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        async with Session() as session:
            print("\nUpserting warehouses...")
            created_wh: list[Warehouse] = []
            for p in WAREHOUSES:
                r = await session.execute(select(Warehouse).where(Warehouse.name == p["name"]))
                wh = r.scalars().first()
                if wh is None:
                    wh = Warehouse(
                        name=p["name"],
                        address=p["address"],
                        capacity=p["capacity"],
                        status=p["status"],
                        data=p["metadata"],
                    )
                    session.add(wh)
                else:
                    wh.address = p["address"]
                    wh.capacity = p["capacity"]
                    wh.status = p["status"]
                    wh.data = p["metadata"]
                created_wh.append(wh)
                print(f"  ok {wh.name}")
            await session.flush()

            print("\nUpserting safe zones...")
            created_sz: list[SafeZone] = []
            for p in SAFE_ZONES:
                r = await session.execute(select(SafeZone).where(SafeZone.name == p["name"]))
                sz = r.scalars().first()
                if sz is None:
                    sz = SafeZone(
                        name=p["name"],
                        capacity=p["capacity"],
                        status=p["status"],
                        data={**p["metadata"], "bounds": p["bounds"]},
                    )
                    session.add(sz)
                else:
                    sz.capacity = p["capacity"]
                    sz.status = p["status"]
                    sz.data = {**p["metadata"], "bounds": p["bounds"]}
                created_sz.append(sz)
                print(f"  ok {sz.name}")
            await session.flush()

            print("\nUpserting items...")
            created_items: list[Item] = []
            for p in ITEMS:
                r = await session.execute(select(Item).where(Item.sku == p["sku"]))
                item = r.scalars().first()
                if item is None:
                    item = Item(sku=p["sku"], name=p["name"], description=p["description"], unit=p["unit"])
                    session.add(item)
                else:
                    item.name = p["name"]
                    item.description = p["description"]
                    item.unit = p["unit"]
                created_items.append(item)
                print(f"  ok {item.sku}")
            await session.flush()

            print("\nUpserting inventory...")
            for wh_idx, items_list in INVENTORY:
                wh = created_wh[wh_idx]
                for item_idx, qty in items_list:
                    item = created_items[item_idx]
                    r = await session.execute(
                        select(WarehouseInventory).where(
                            WarehouseInventory.warehouse_id == wh.id,
                            WarehouseInventory.item_id == item.id,
                        )
                    )
                    inv = r.scalars().first()
                    if inv is None:
                        inv = WarehouseInventory(warehouse_id=wh.id, item_id=item.id, quantity=qty)
                        session.add(inv)
                    else:
                        inv.quantity = qty
                    print(f"  ok {wh.name} / {item.name} = {qty}")

            await session.commit()

        print(f"\nDone. {len(created_wh)} warehouses · {len(created_sz)} safe zones · {len(ITEMS)} items.")
    finally:
        await engine.dispose()


# ── Entry point ───────────────────────────────────────────────────────────────

def _detect_mode(db_url: str) -> str:
    if "sqlite" in db_url.lower():
        return "sqlite"
    return "postgres"


def main() -> None:
    parser = argparse.ArgumentParser(description="GeoSafe unified seed script")
    parser.add_argument("--mode", choices=["postgres", "sqlite"], default=None)
    args = parser.parse_args()

    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe_db",
    )

    mode = args.mode or _detect_mode(db_url)

    if mode == "sqlite":
        if "sqlite" not in db_url.lower():
            db_url = "sqlite+aiosqlite:///./geosafe.db"
        asyncio.run(_seed_sqlite(db_url))
    else:
        asyncio.run(_seed_postgres(db_url))


if __name__ == "__main__":
    main()
