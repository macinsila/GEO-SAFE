"""
E2E seed script — idempotent setup of test fixtures for Playwright smoke tests.

Creates:
  - e2e-admin@geosafe.test    (role: admin)
  - e2e-operator@geosafe.test (role: operator)
  - "E2E Test Depot" warehouse with location
  - "E2E-SU-001" inventory item (active)
  - WarehouseInventory row: 10 litres of E2E-SU-001 in E2E Test Depot

Run before `playwright test`:
  DATABASE_URL=postgresql+asyncpg://... python e2e/seed.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from passlib.context import CryptContext
from geoalchemy2.elements import WKTElement
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe_test_db",
)

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

E2E_USERS = [
    {"name": "E2E Admin", "email": "e2e-admin@geosafe.test", "role": "admin"},
    {"name": "E2E Operator", "email": "e2e-operator@geosafe.test", "role": "operator"},
]
E2E_PASSWORD = "E2ePassw0rd!"


async def seed() -> None:
    from app.models.item import Item
    from app.models.user import User
    from app.models.warehouse import Warehouse
    from app.models.warehouse_inventory import WarehouseInventory

    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with Session() as db:
        # ── Users ──────────────────────────────────────────────────────────────
        for spec in E2E_USERS:
            exists = (
                await db.execute(select(User).where(User.email == spec["email"]))
            ).scalar_one_or_none()
            if exists is None:
                db.add(
                    User(
                        name=spec["name"],
                        email=spec["email"],
                        role=spec["role"],
                        password_hash=_pwd.hash(E2E_PASSWORD),
                        email_verified=True,
                    )
                )
                print(f"  created {spec['email']}")
            else:
                print(f"  exists  {spec['email']}")

        await db.commit()

        # ── Warehouse ──────────────────────────────────────────────────────────
        wh = (
            await db.execute(select(Warehouse).where(Warehouse.name == "E2E Test Depot"))
        ).scalar_one_or_none()
        if wh is None:
            wh = Warehouse(
                name="E2E Test Depot",
                address="E2E Sokak 1, Kadıköy, İstanbul",
                capacity=1000,
                status="active",
                location=WKTElement("POINT(29.023 40.991)", srid=4326),
                data={"location": {"lon": 29.023, "lat": 40.991}},
            )
            db.add(wh)
            await db.flush()
            print("  created E2E Test Depot")
        else:
            print("  exists  E2E Test Depot")

        # ── Inventory item ─────────────────────────────────────────────────────
        item = (
            await db.execute(select(Item).where(Item.sku == "E2E-SU-001"))
        ).scalar_one_or_none()
        if item is None:
            item = Item(
                name="E2E Test Su",
                sku="E2E-SU-001",
                unit="litre",
                low_stock_threshold=50,
                is_active=True,
            )
            db.add(item)
            await db.flush()
            print("  created E2E-SU-001")
        else:
            print("  exists  E2E-SU-001")

        await db.commit()

        # ── Warehouse inventory row ────────────────────────────────────────────
        # Re-read after commit so IDs are reliably set
        wh_id = (
            await db.execute(
                select(Warehouse.id).where(Warehouse.name == "E2E Test Depot")
            )
        ).scalar_one()
        item_id = (
            await db.execute(select(Item.id).where(Item.sku == "E2E-SU-001"))
        ).scalar_one()

        inv = (
            await db.execute(
                select(WarehouseInventory).where(
                    and_(
                        WarehouseInventory.warehouse_id == wh_id,
                        WarehouseInventory.item_id == item_id,
                    )
                )
            )
        ).scalar_one_or_none()

        if inv is None:
            db.add(
                WarehouseInventory(
                    warehouse_id=wh_id,
                    item_id=item_id,
                    quantity=10,
                )
            )
            print(f"  created inventory: 10 litres E2E-SU-001 @ E2E Test Depot")
        else:
            print("  exists  inventory row")

        await db.commit()

    await engine.dispose()
    print("E2E seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
