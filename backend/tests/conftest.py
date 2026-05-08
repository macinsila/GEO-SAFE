import asyncio
import os
from collections.abc import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from geoalchemy2.elements import WKTElement
from sqlalchemy import create_engine, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker


ENV_DB_CANDIDATES = ("TEST_DATABASE_URL", "DATABASE_URL")


def _resolve_raw_database_url() -> str:
    raw_url = None
    for env_key in ENV_DB_CANDIDATES:
        value = os.getenv(env_key)
        if value:
            raw_url = value
            break

    if not raw_url:
        raise RuntimeError(
            "Test DB connection string is missing. Set TEST_DATABASE_URL (preferred) or DATABASE_URL to a PostGIS-enabled PostgreSQL URL."
        )

    if "sqlite" in raw_url.lower():
        raise RuntimeError("SQLite is not supported for these tests. Use a PostGIS-enabled PostgreSQL database.")

    return raw_url


def _to_async_url(raw_url: str) -> str:
    if raw_url.startswith("postgresql+asyncpg://"):
        return raw_url
    if raw_url.startswith("postgresql+psycopg://"):
        return raw_url.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+asyncpg://", 1)

    raise RuntimeError(
        "Unsupported DB URL format. Expected postgresql+asyncpg://..., postgresql+psycopg://..., or postgresql://..."
    )


def _to_sync_url(async_url: str) -> str:
    if async_url.startswith("postgresql+asyncpg://"):
        return async_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    raise RuntimeError("Expected async URL to start with postgresql+asyncpg://")


RAW_DATABASE_URL = _resolve_raw_database_url()
ASYNC_DATABASE_URL = _to_async_url(RAW_DATABASE_URL)
SYNC_DATABASE_URL = _to_sync_url(ASYNC_DATABASE_URL)

# Ensure app imports and dependencies use async test URL.
os.environ["DATABASE_URL"] = ASYNC_DATABASE_URL
os.environ.setdefault("JWT_SECRET", "test-secret-change-me")

from app.api.auth import get_current_user  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.models.item import Item  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.warehouse import Warehouse  # noqa: E402
from app.models.warehouse_inventory import WarehouseInventory  # noqa: E402


async_engine = create_async_engine(ASYNC_DATABASE_URL, future=True, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

sync_engine = create_engine(SYNC_DATABASE_URL, future=True, echo=False, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False)


def _truncate_all_tables() -> None:
    table_names = ", ".join(f'"{table.name}"' for table in reversed(Base.metadata.sorted_tables))
    if not table_names:
        return

    with sync_engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE"))


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> Generator[None, None, None]:
    with sync_engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        Base.metadata.create_all(bind=conn)

    yield

    with sync_engine.begin() as conn:
        Base.metadata.drop_all(bind=conn)

    sync_engine.dispose()
    asyncio.run(async_engine.dispose())


@pytest.fixture(autouse=True)
def clean_database(setup_test_database):
    _truncate_all_tables()


@pytest.fixture
def data_factory() -> dict[str, Callable]:
    def create_warehouse(
        *,
        name: str,
        lon: float,
        lat: float,
        status: str = "active",
        capacity: int = 100,
        address: str | None = None,
    ) -> dict:
        with SyncSessionLocal() as session:
            warehouse = Warehouse(
                name=name,
                address=address or f"{name} Address",
                capacity=capacity,
                status=status,
                location=WKTElement(f"POINT({lon} {lat})", srid=4326),
                data={"location": {"lon": lon, "lat": lat}},
            )
            session.add(warehouse)
            session.commit()
            session.refresh(warehouse)
            return {
                "id": warehouse.id,
                "name": warehouse.name,
                "status": warehouse.status,
                "capacity": warehouse.capacity,
                "lon": lon,
                "lat": lat,
            }

    def create_item(*, name: str, sku: str, unit: str = "unit") -> dict:
        with SyncSessionLocal() as session:
            item = Item(name=name, sku=sku, unit=unit)
            session.add(item)
            session.commit()
            session.refresh(item)
            return {"id": item.id, "name": item.name, "sku": item.sku, "unit": item.unit}

    def create_warehouse_inventory(*, warehouse_id: int, item_id: int, quantity: int) -> dict:
        with SyncSessionLocal() as session:
            inventory = WarehouseInventory(
                warehouse_id=warehouse_id,
                item_id=item_id,
                quantity=quantity,
            )
            session.add(inventory)
            session.commit()
            session.refresh(inventory)
            return {
                "id": inventory.id,
                "warehouse_id": inventory.warehouse_id,
                "item_id": inventory.item_id,
                "quantity": inventory.quantity,
            }

    def get_inventory(*, warehouse_id: int, item_id: int) -> dict | None:
        with SyncSessionLocal() as session:
            stmt = select(WarehouseInventory).where(
                WarehouseInventory.warehouse_id == warehouse_id,
                WarehouseInventory.item_id == item_id,
            )
            row = session.execute(stmt).scalar_one_or_none()
            if row is None:
                return None
            return {
                "id": row.id,
                "warehouse_id": row.warehouse_id,
                "item_id": row.item_id,
                "quantity": row.quantity,
            }

    return {
        "create_warehouse": create_warehouse,
        "create_item": create_item,
        "create_warehouse_inventory": create_warehouse_inventory,
        "get_inventory": get_inventory,
    }


@pytest.fixture(scope="session")
def client(setup_test_database):
    async def _override_get_db():
        async with AsyncSessionLocal() as session:
            yield session

    async def _override_current_user():
        return User(id=1, name="Test Admin", email="admin@test.local", role="admin")

    original_startup_handlers = list(app.router.on_startup)
    app.router.on_startup = []

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_current_user

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    app.router.on_startup = original_startup_handlers
