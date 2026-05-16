import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import warehouses, safe_zones, auth, emergency, inventory, earthquakes, profile, spatial, volunteers, shelter_offers
from app.db.session import engine
from app.models.base import Base
from app.api.response import success_response, error_response
from app.api.auth import validate_jwt_secret
# Tüm modelleri import et - Base.metadata.registry'ye kayıtlı olmalarını sağla
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.safe_zone import SafeZone
from app.models.item import Item
from app.models.warehouse_inventory import WarehouseInventory
from app.models.inventory_movement import InventoryMovement
from app.models.emergency_report import EmergencyReport
from app.models.volunteer_application import VolunteerApplication
from app.models.shelter_offer import ShelterOffer

app = FastAPI(title="GeoSafe API")

# CORS: read allowed origins from env; default to localhost dev URLs only.
# In production set: CORS_ORIGINS=https://pilot.geosafe.app,https://admin.geosafe.app
_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    validate_jwt_secret(os.getenv("JWT_SECRET"))
    try:
        auto_create = os.getenv("AUTO_CREATE_TABLES", "false").strip().lower() in {"1", "true", "yes"}
        if auto_create:
            # Async engine ile tabloları oluştur
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("✅ Veritabanı tabloları başarıyla oluşturuldu!")
    except Exception as e:
        print(f"⚠️ Veritabanı bağlantı hatası: {e}")
        print("⚠️ Not: API yine de çalışacak, ama veritabanı işlemleri başarısız olacak.")

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
