"""
Small database status helper for GeoSafe.

Usage:
  python scripts/db_status.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.item import Item
from app.models.safe_zone import SafeZone
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.warehouse_inventory import WarehouseInventory

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe_db",
)


async def scalar_count(session: AsyncSession, model) -> int:
    result = await session.execute(select(func.count()).select_from(model))
    return int(result.scalar_one())


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session() as session:
            print(f"Database URL: {DATABASE_URL}")
            print(f"Users: {await scalar_count(session, User)}")
            print(f"Warehouses: {await scalar_count(session, Warehouse)}")
            print(f"Safe zones: {await scalar_count(session, SafeZone)}")
            print(f"Items: {await scalar_count(session, Item)}")
            print(f"Inventory rows: {await scalar_count(session, WarehouseInventory)}")

            result = await session.execute(
                select(User.id, User.email, User.role).order_by(User.id)
            )
            users = result.all()
            print("User list:")
            for user_id, email, role in users:
                print(f"  - #{user_id} {email} ({role})")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
