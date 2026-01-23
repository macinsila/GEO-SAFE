"""
Database session and connection management.
Uses SQLAlchemy async for non-blocking queries.
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite+aiosqlite:///./geosafe.db"

# Async engine: allows non-blocking DB operations
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} # SQLite için bunu eklemek iyidir
)

# Session factory: creates new session instances
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    """
    Dependency injection function for FastAPI.
    Provides a session to each endpoint.
    Automatically closes the session after the request.
    """
    async with AsyncSessionLocal() as session:
        yield session
