# ruff: noqa: E402
import os

from dotenv import load_dotenv

load_dotenv()

from app.core.logging_config import RequestIDMiddleware, configure_logging

configure_logging(os.getenv("LOG_LEVEL", "INFO"))

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.2,
        environment=os.getenv("ENVIRONMENT", "development"),
        send_default_pii=False,
    )
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import admin as admin_api
from app.api import (
    admin_import,
    announcements,
    auth,
    channels,
    chat,
    checkin,
    earthquakes,
    emergency,
    geofence,
    inventory,
    kpi,
    missing_persons,
    profile,
    push,
    qr,
    reports,
    routing,
    safe_zones,
    shelter_offers,
    spatial,
    sse,
    transfers,
    volunteer_tasks,
    volunteers,
    warehouses,
    zone_needs,
)
from app.api.auth import validate_jwt_secret
from app.api.observability import MetricsMiddleware, collector
from app.api.response import error_response, success_response
from app.core import cache as _cache
from app.db import get_db
from app.db.session import engine
from app.models.base import Base

# Tüm modelleri import et - Base.metadata.registry'ye kayıtlı olmalarını sağla

app = FastAPI(title="GeoSafe API")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()"
        # HSTS: enforce HTTPS for 1 year (only meaningful behind TLS termination)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # CSP: restrict sources; adjust as CDN/map-tile origins expand
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; "
            "img-src 'self' data: https://*.tile.openstreetmap.org "
            "https://raw.githubusercontent.com https://cdnjs.cloudflare.com; "
            "connect-src 'self'; "
            "font-src 'self'; "
            "frame-ancestors 'none';"
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(MetricsMiddleware)

# CORS: read allowed origins from env. Vercel preview/production URLs are
# supported by default because this project deploys the frontend on Vercel.
# In production, set CORS_ORIGINS to the exact frontend URL when possible.
_raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173,http://localhost:8000",
)
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
allowed_origin_regex = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app").strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _validate_config() -> None:
    """Fail fast on boot if required environment variables are missing or unsafe."""
    errors: list[str] = []

    jwt_secret = os.getenv("JWT_SECRET", "")
    try:
        validate_jwt_secret(jwt_secret)
    except RuntimeError as exc:
        errors.append(str(exc))

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        errors.append("DATABASE_URL is not set. Provide a PostgreSQL connection string.")
    elif "sqlite" in db_url.lower():
        errors.append("DATABASE_URL points to SQLite — production requires PostgreSQL/PostGIS.")

    cors_raw = os.getenv("CORS_ORIGINS", "")
    if not cors_raw:
        errors.append(
            "CORS_ORIGINS is not set. Defaulting to localhost — set this in production."
        )

    if errors:
        msg = "\n".join(f"  ✗ {e}" for e in errors)
        raise RuntimeError(f"GeoSafe startup config errors:\n{msg}")


@app.on_event("startup")
async def on_startup():
    try:
        _validate_config()
        print("✅ Config validation passed.")
    except RuntimeError as exc:
        # Log clearly but don't crash the process — let DB failure surface naturally
        print(f"⚠️ Config warnings:\n{exc}")

    try:
        auto_create = os.getenv("AUTO_CREATE_TABLES", "false").strip().lower() in {"1", "true", "yes"}
        if auto_create:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("✅ Veritabanı tabloları başarıyla oluşturuldu!")
    except Exception as e:
        print(f"⚠️ Veritabanı bağlantı hatası: {e}")
        print("⚠️ Not: API yine de çalışacak, ama veritabanı işlemleri başarısız olacak.")

    await _cache.connect()


@app.on_event("shutdown")
async def on_shutdown():
    await _cache.disconnect()

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(warehouses.router, prefix="/api/v1/warehouses", tags=["warehouses"])
app.include_router(safe_zones.router, prefix="/api/v1/safe-zones", tags=["safe-zones"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["inventory"])
app.include_router(emergency.router, prefix="/api/v1/emergency", tags=["emergency"])
app.include_router(earthquakes.router, prefix="/api/v1/earthquakes", tags=["earthquakes"])
app.include_router(profile.router, prefix="/api/v1/profile", tags=["profile"])
app.include_router(spatial.router, prefix="/api/v1/spatial", tags=["spatial"])
app.include_router(volunteers.router, prefix="/api/v1/volunteers", tags=["volunteers"])
app.include_router(shelter_offers.router, prefix="/api/v1/shelter-offers", tags=["shelter-offers"])
app.include_router(qr.router, prefix="/api/v1/qr", tags=["qr"])
app.include_router(announcements.router, prefix="/api/v1/announcements", tags=["announcements"])
app.include_router(sse.router, prefix="/api/v1/sse", tags=["sse"])
app.include_router(checkin.router, prefix="/api/v1/checkin", tags=["checkin"])
app.include_router(routing.router, prefix="/api/v1/routing", tags=["routing"])
app.include_router(transfers.router, prefix="/api/v1/transfers", tags=["transfers"])
app.include_router(zone_needs.router, prefix="/api/v1/zone-needs", tags=["zone-needs"])
app.include_router(push.router, prefix="/api/v1/push", tags=["push"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(admin_api.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(volunteer_tasks.router, prefix="/api/v1/volunteer-tasks", tags=["volunteer-tasks"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(kpi.router, prefix="/api/v1/kpi", tags=["kpi"])
app.include_router(admin_import.router, prefix="/api/v1/admin/import", tags=["admin-import"])
app.include_router(geofence.router, prefix="/api/v1/geofence", tags=["geofence"])
app.include_router(channels.router, prefix="/api/v1/channels", tags=["channels"])
app.include_router(missing_persons.router, prefix="/api/v1/missing-persons", tags=["missing-persons"])


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and {"status", "data", "message"}.issubset(detail.keys()):
        payload = detail
    else:
        payload = error_response(str(detail))
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=error_response(f"Unexpected server error: {str(exc)}")
    )

@app.get("/")
async def root():
    return success_response(data={"service": "GeoSafe API"}, message="GeoSafe backend is running")

@app.get("/health")
async def health():
    return success_response(data={"health": "healthy"}, message="Service is healthy")


@app.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return success_response(data={"ready": True}, message="Service is ready")
    except Exception:
        raise HTTPException(status_code=503, detail="Database not reachable")


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return PlainTextResponse(
        collector.prometheus_text(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
