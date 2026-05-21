"""
Database session and connection management.
Uses SQLAlchemy async for non-blocking queries.
"""

import os
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker


def _repair_unescaped_fragment(url: str) -> str:
    """Treat an unescaped # in a DB password as part of the password."""
    if "#" not in url:
        return url

    before_fragment, fragment = url.split("#", 1)
    if "@" in before_fragment:
        return url

    return before_fragment + "%23" + fragment


def _normalize_database_url(raw_url: str) -> str:
    url = _repair_unescaped_fragment(raw_url.strip())

    if url.startswith("sqlite"):
        return url

    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url.removeprefix("postgresql://")
    elif url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url.removeprefix("postgres://")

    parsed = urlsplit(url)
    host = parsed.hostname or ""

    if host.startswith("db.") and host.endswith(".supabase.co"):
        project_ref = host.removeprefix("db.").removesuffix(".supabase.co")
        pooler_host = os.getenv("SUPABASE_POOLER_HOST", "aws-1-ap-northeast-1.pooler.supabase.com").strip()
        user = parsed.username or "postgres"
        password = unquote(parsed.password or "")
        username = user if "." in user else f"{user}.{project_ref}"
        auth = quote(username, safe="") + ":" + quote(password, safe="")
        netloc = f"{auth}@{pooler_host}:6543"
        query = parsed.query
        if "ssl=" not in query:
            query = f"{query}&ssl=require" if query else "ssl=require"
        return urlunsplit((parsed.scheme, netloc, parsed.path or "/postgres", query, ""))

    return url


DATABASE_URL = _normalize_database_url(os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./geosafe.db"))


def _safe_database_url_summary(url: str) -> str:
    try:
        parsed = urlsplit(url)
        return (
            f"scheme={parsed.scheme} "
            f"host={parsed.hostname or '<none>'} "
            f"port={parsed.port or '<default>'} "
            f"user={parsed.username or '<none>'} "
            f"database={parsed.path.lstrip('/') or '<none>'}"
        )
    except Exception:
        return "<unparseable database url>"


print(f"Database configuration: {_safe_database_url_summary(DATABASE_URL)}")

# SQLite mi Postgres mu otomatik anla
is_sqlite = DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if is_sqlite else {}

# Async engine: allows non-blocking DB operations
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_timeout=30,
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
