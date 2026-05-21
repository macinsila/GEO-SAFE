"""
GeoSafe database seeding script.

This script is intentionally idempotent:
- Existing warehouses/safe zones/items are updated in place.
- Existing warehouse inventory rows are updated instead of duplicated.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
from geoalchemy2.elements import WKTElement
from shapely.geometry import Point, Polygon
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.item import Item
from app.models.safe_zone import SafeZone
from app.models.warehouse import Warehouse
from app.models.warehouse_inventory import WarehouseInventory

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe_db",
)


SAMPLE_WAREHOUSES = [
    {
        "name": "Kadıköy Central Warehouse",
        "location": (29.0230, 40.9910),
        "address": "Bahariye Cad. 45, Kadıköy, İstanbul",
        "capacity": 5000,
        "status": "active",
        "metadata": {
            "manager": "Ahmet Yilmaz",
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
        "address": "Moda Cad. 78, Kadikoy, Istanbul",
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
            "manager": "Ibrahim Yildiz",
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
            "manager": "Leyla Ozdemir",
            "phone": "+90 216 654 3210",
            "operating_hours": "08:00-17:00",
            "equipment": ["climate control", "inventory system"],
        },
    },
]

SAMPLE_SAFE_ZONES = [
    {
        "name": "Kadıköy Central Safe Zone",
        "capacity": 5000,
        "status": "verified",
        "geometry": Polygon(
            [
                (29.0150, 40.9800),
                (29.0350, 40.9800),
                (29.0350, 41.0000),
                (29.0150, 41.0000),
                (29.0150, 40.9800),
            ]
        ),
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
        "geometry": Polygon(
            [
                (28.9900, 41.0350),
                (29.0200, 41.0350),
                (29.0200, 41.0600),
                (28.9900, 41.0600),
                (28.9900, 41.0350),
            ]
        ),
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
        "geometry": Polygon(
            [
                (29.0200, 40.9700),
                (29.0550, 40.9700),
                (29.0550, 40.9950),
                (29.0200, 40.9950),
                (29.0200, 40.9700),
            ]
        ),
        "metadata": {
            "type": "street_corridor",
            "facilities": ["clear path", "checkpoints"],
            "last_verified": "2024-12-18",
        },
    },
]

SAMPLE_ITEMS = [
    {"sku": "BLANKET-001", "name": "Blanket", "description": "Thermal emergency blanket.", "unit": "piece"},
    {"sku": "WATER-001", "name": "Water (liter)", "description": "Potable water supply.", "unit": "liter"},
    {"sku": "MEDKIT-001", "name": "Medical Kit", "description": "Basic medical kit for first response.", "unit": "piece"},
    {"sku": "FOOD-001", "name": "Food Package", "description": "Non-perishable emergency food.", "unit": "box"},
    {"sku": "TENT-001", "name": "Tent", "description": "Emergency shelter tent.", "unit": "piece"},
    {"sku": "FIRSTAID-001", "name": "First Aid Supplies", "description": "First aid refills and supplies.", "unit": "pack"},
]


async def get_or_create_warehouse(session: AsyncSession, payload: dict) -> Warehouse:
    result = await session.execute(select(Warehouse).where(Warehouse.name == payload["name"]))
    warehouse = result.scalars().first()
    if warehouse is None:
        warehouse = Warehouse(name=payload["name"])
        session.add(warehouse)

    lon, lat = payload["location"]
    warehouse.location = WKTElement(Point(lon, lat).wkt, srid=4326)
    warehouse.address = payload["address"]
    warehouse.capacity = payload["capacity"]
    warehouse.status = payload["status"]
    warehouse.data = payload["metadata"]
    return warehouse


async def get_or_create_safe_zone(session: AsyncSession, payload: dict) -> SafeZone:
    result = await session.execute(select(SafeZone).where(SafeZone.name == payload["name"]))
    safe_zone = result.scalars().first()
    if safe_zone is None:
        safe_zone = SafeZone(name=payload["name"])
        session.add(safe_zone)

    safe_zone.capacity = payload["capacity"]
    safe_zone.status = payload["status"]
    safe_zone.data = payload["metadata"]
    safe_zone.geometry = WKTElement(payload["geometry"].wkt, srid=4326)
    return safe_zone


async def get_or_create_item(session: AsyncSession, payload: dict) -> Item:
    result = await session.execute(select(Item).where(Item.sku == payload["sku"]))
    item = result.scalars().first()
    if item is None:
        item = Item(sku=payload["sku"])
        session.add(item)

    item.name = payload["name"]
    item.description = payload["description"]
    item.unit = payload["unit"]
    return item


async def upsert_inventory(session: AsyncSession, warehouse_id: int, item_id: int, quantity: int) -> WarehouseInventory:
    result = await session.execute(
        select(WarehouseInventory).where(
            WarehouseInventory.warehouse_id == warehouse_id,
            WarehouseInventory.item_id == item_id,
        )
    )
    inventory = result.scalars().first()
    if inventory is None:
        inventory = WarehouseInventory(warehouse_id=warehouse_id, item_id=item_id)
        session.add(inventory)

    inventory.quantity = quantity
    return inventory


async def seed_database() -> None:
    print(f"Connecting to database: {DATABASE_URL}")

    engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session() as session:
            print("\nUpserting warehouses...")
            created_warehouses: list[Warehouse] = []
            for payload in SAMPLE_WAREHOUSES:
                warehouse = await get_or_create_warehouse(session, payload)
                created_warehouses.append(warehouse)
                print(f"  OK warehouse: {warehouse.name}")

            await session.flush()

            print("\nUpserting safe zones...")
            created_safe_zones: list[SafeZone] = []
            for payload in SAMPLE_SAFE_ZONES:
                safe_zone = await get_or_create_safe_zone(session, payload)
                created_safe_zones.append(safe_zone)
                print(f"  OK safe zone: {safe_zone.name}")

            await session.flush()

            print("\nUpserting items...")
            created_items: list[Item] = []
            for payload in SAMPLE_ITEMS:
                item = await get_or_create_item(session, payload)
                created_items.append(item)
                print(f"  OK item: {item.sku}")

            await session.flush()

            print("\nUpserting warehouse inventory...")
            inventory_mapping = [
                (created_warehouses[0], [(created_items[0], 500), (created_items[1], 2000), (created_items[2], 50)]),
                (created_warehouses[1], [(created_items[0], 800), (created_items[1], 3000), (created_items[2], 100), (created_items[3], 400), (created_items[4], 30)]),
                (created_warehouses[2], [(created_items[2], 150), (created_items[5], 200), (created_items[1], 500)]),
                (created_warehouses[3], [(created_items[0], 600), (created_items[1], 2500), (created_items[3], 300), (created_items[4], 25)]),
                (created_warehouses[4], [(created_items[0], 700), (created_items[1], 2200), (created_items[2], 75), (created_items[3], 350)]),
            ]

            for warehouse, items_list in inventory_mapping:
                for item, quantity in items_list:
                    await upsert_inventory(session, warehouse.id, item.id, quantity)
                    print(f"  OK inventory: {warehouse.name} / {item.name} = {quantity}")

            await session.commit()
            print("\nDatabase seed complete.")
            print(f"  Warehouses: {len(created_warehouses)}")
            print(f"  Safe zones: {len(created_safe_zones)}")
            print(f"  Items: {len(created_items)}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_database())
