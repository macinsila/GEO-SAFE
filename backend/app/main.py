from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import warehouses, safe_zones, auth
from app.db.session import engine
from app.models.base import Base
# Tüm modelleri import et - Base.metadata.registry'ye kayıtlı olmalarını sağla
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.safe_zone import SafeZone
from app.models.item import Item
from app.models.warehouse_inventory import WarehouseInventory
from app.models.inventory_movement import InventoryMovement

app = FastAPI(title="GeoSafe API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Her yerden gelen isteğe izin ver
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST hepsine izin ver
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    try:
        # Async engine ile tabloları oluştur
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Veritabanı tabloları başarıyla oluşturuldu!")
    except Exception as e:
        print(f"⚠️ Veritabanı bağlantı hatası: {e}")
        print("⚠️ Not: API yine de çalışacak, ama veritabanı işlemleri başarısız olacak.")

app.include_router(auth.router)
app.include_router(warehouses.router, prefix="/api/warehouses", tags=["warehouses"])
app.include_router(safe_zones.router, prefix="/api/safe-zones", tags=["safe-zones"])

@app.get("/")
async def root():
    return {"status": "ok", "message": "GeoSafe backend is running"}

app.include_router(auth.router)