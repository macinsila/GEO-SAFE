"""
Pilot Seed Data — İstanbul gerçekçi test verisi.
Çalıştırma: PYTHONPATH=. python scripts/seed_pilot.py
Upsert mantığı: tekrar çalıştırmada duplicate olmaz.
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, and_, text
from geoalchemy2.elements import WKTElement

from app.db.session import AsyncSessionLocal
from app.models.warehouse import Warehouse
from app.models.safe_zone import SafeZone
from app.models.item import Item
from app.models.warehouse_inventory import WarehouseInventory

# ---------------------------------------------------------------------------
# Veri tanımları
# ---------------------------------------------------------------------------

WAREHOUSES = [
    {
        "name": "Pilot — Fatih Lojistik Deposu",
        "address": "Millet Cad. 12, Fatih, İstanbul",
        "capacity": 5000,
        "status": "active",
        "lat": 41.0082,
        "lon": 28.9450,
    },
    {
        "name": "Pilot — Beyoğlu Destek Deposu",
        "address": "İstiklal Cad. 88, Beyoğlu, İstanbul",
        "capacity": 3000,
        "status": "active",
        "lat": 41.0325,
        "lon": 28.9775,
    },
    {
        "name": "Pilot — Şişli Kuzey Deposu",
        "address": "Büyükdere Cad. 45, Şişli, İstanbul",
        "capacity": 4000,
        "status": "active",
        "lat": 41.0600,
        "lon": 28.9870,
    },
    {
        "name": "Pilot — Eminönü Pasif Depo",
        "address": "Tahtakale Mah. 7, Eminönü, İstanbul",
        "capacity": 2000,
        "status": "inactive",
        "lat": 41.0160,
        "lon": 28.9720,
    },
    {
        "name": "Pilot — Kapalıçarşı Riskli Depo",
        "address": "Nuruosmaniye Cad. 3, Fatih, İstanbul",
        "capacity": 1500,
        "status": "risky",
        "lat": 41.0105,
        "lon": 28.9680,
    },
]

SAFE_ZONES = [
    {
        "name": "Pilot — Sultanahmet Meydan Toplanma",
        "capacity": 8000,
        "minLon": 28.972, "maxLon": 28.980, "minLat": 41.004, "maxLat": 41.010,
    },
    {
        "name": "Pilot — Taksim Gezi Parkı",
        "capacity": 5000,
        "minLon": 28.975, "maxLon": 28.982, "minLat": 41.036, "maxLat": 41.041,
    },
    {
        "name": "Pilot — Beşiktaş Çarşı Meydanı",
        "capacity": 4000,
        "minLon": 29.001, "maxLon": 29.008, "minLat": 41.040, "maxLat": 41.046,
    },
    {
        "name": "Pilot — Şişli Cumhuriyet Alanı",
        "capacity": 3500,
        "minLon": 28.983, "maxLon": 28.990, "minLat": 41.055, "maxLat": 41.061,
    },
    {
        "name": "Pilot — Bakırköy Özgürlük Meydanı",
        "capacity": 6000,
        "minLon": 28.870, "maxLon": 28.878, "minLat": 40.980, "maxLat": 40.986,
    },
]

ITEMS = [
    {"sku": "ITM-BATTANIYE", "name": "battaniye",     "unit": "adet",  "description": "Standart ısı yalıtımlı battaniye"},
    {"sku": "ITM-KURU-GIDA",  "name": "kuru_gida",    "unit": "paket", "description": "14 günlük kuru gıda paketi"},
    {"sku": "ITM-ILAC",       "name": "ilac",         "unit": "kutu",  "description": "Temel ilaç seti"},
    {"sku": "ITM-SU",         "name": "su",           "unit": "litre", "description": "İçme suyu (20 lt damacana)"},
    {"sku": "ITM-YANGIN",     "name": "yangin_malzemesi", "unit": "adet", "description": "6 kg kuru tozlu yangın tüpü"},
]

# warehouse_name → {item_sku: quantity}
# Fatih aktif depo, kapasitesi 5000; su stoku %15 = 750 birim → düşük stok uyarısı tetiklenir
INVENTORY = {
    "Pilot — Fatih Lojistik Deposu": {
        "ITM-BATTANIYE": 1200,
        "ITM-KURU-GIDA":  800,
        "ITM-ILAC":       300,
        "ITM-SU":         150,   # %15 → uyarı eşiği altında
        "ITM-YANGIN":      50,
    },
    "Pilot — Beyoğlu Destek Deposu": {
        "ITM-BATTANIYE": 600,
        "ITM-KURU-GIDA": 400,
        "ITM-ILAC":      200,
        "ITM-SU":        900,
        "ITM-YANGIN":     80,
    },
    "Pilot — Şişli Kuzey Deposu": {
        "ITM-BATTANIYE": 2000,
        "ITM-KURU-GIDA": 1500,
        "ITM-ILAC":       500,
        "ITM-SU":        3000,
        "ITM-YANGIN":     200,
    },
}


# ---------------------------------------------------------------------------
# Upsert yardımcıları
# ---------------------------------------------------------------------------

async def upsert_warehouse(db, data: dict) -> Warehouse:
    result = await db.execute(select(Warehouse).where(Warehouse.name == data["name"]))
    wh = result.scalar_one_or_none()
    wkt = WKTElement(f"POINT({data['lon']} {data['lat']})", srid=4326)
    if wh is None:
        wh = Warehouse(
            name=data["name"],
            address=data["address"],
            capacity=data["capacity"],
            status=data["status"],
            location=wkt,
            data={"location": {"lon": data["lon"], "lat": data["lat"]}},
        )
        db.add(wh)
        print(f"  ➕ Depo eklendi: {data['name']} [{data['status']}]")
    else:
        wh.address = data["address"]
        wh.capacity = data["capacity"]
        wh.status = data["status"]
        wh.location = wkt
        wh.data = {"location": {"lon": data["lon"], "lat": data["lat"]}}
        print(f"  ✏️  Depo güncellendi: {data['name']} [{data['status']}]")
    return wh


async def upsert_safe_zone(db, data: dict) -> None:
    """
    SafeZone upsert via raw SQL to avoid model String vs DB geometry type mismatch.
    Builds a proper rectangular WKT Polygon from the bounds.
    """
    minLon, maxLon = data["minLon"], data["maxLon"]
    minLat, maxLat = data["minLat"], data["maxLat"]

    # Rectangular polygon: SW → SE → NE → NW → SW
    wkt = (
        f"POLYGON(("
        f"{minLon} {minLat}, {maxLon} {minLat}, "
        f"{maxLon} {maxLat}, {minLon} {maxLat}, "
        f"{minLon} {minLat}"
        f"))"
    )
    bounds_json = json.dumps({
        "bounds": {
            "minLon": minLon, "maxLon": maxLon,
            "minLat": minLat, "maxLat": maxLat,
        }
    })

    existing = await db.execute(
        select(SafeZone.id).where(SafeZone.name == data["name"])
    )
    existing_id = existing.scalar_one_or_none()

    if existing_id is None:
        await db.execute(
            text(
                "INSERT INTO safe_zones "
                "(name, geometry, capacity, capacity_type, status, data) "
                "VALUES (:name, ST_GeomFromText(:wkt, 4326), :cap, 'persons', 'active', CAST(:data AS jsonb))"
            ),
            {"name": data["name"], "wkt": wkt, "cap": data["capacity"], "data": bounds_json},
        )
        print(f"  ➕ Toplanma alanı eklendi: {data['name']}")
    else:
        await db.execute(
            text(
                "UPDATE safe_zones "
                "SET geometry = ST_GeomFromText(:wkt, 4326), "
                "    capacity = :cap, "
                "    data = CAST(:data AS jsonb) "
                "WHERE id = :id"
            ),
            {"wkt": wkt, "cap": data["capacity"], "data": bounds_json, "id": existing_id},
        )
        print(f"  ✏️  Toplanma alanı güncellendi: {data['name']}")


async def upsert_item(db, data: dict) -> Item:
    result = await db.execute(select(Item).where(Item.sku == data["sku"]))
    item = result.scalar_one_or_none()
    if item is None:
        item = Item(
            sku=data["sku"],
            name=data["name"],
            unit=data["unit"],
            description=data.get("description"),
        )
        db.add(item)
        print(f"  ➕ Malzeme eklendi: {data['name']} ({data['sku']})")
    else:
        item.name = data["name"]
        item.unit = data["unit"]
        print(f"  ✏️  Malzeme güncellendi: {data['name']}")
    return item


async def upsert_inventory(db, warehouse_id: int, item_id: int, quantity: int):
    result = await db.execute(
        select(WarehouseInventory).where(
            and_(
                WarehouseInventory.warehouse_id == warehouse_id,
                WarehouseInventory.item_id == item_id,
            )
        )
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        inv = WarehouseInventory(warehouse_id=warehouse_id, item_id=item_id, quantity=quantity)
        db.add(inv)
    else:
        inv.quantity = quantity


# ---------------------------------------------------------------------------
# Ana seed fonksiyonu
# ---------------------------------------------------------------------------

async def seed():
    async with AsyncSessionLocal() as db:
        print("\n🏭 Depolar yükleniyor…")
        wh_map: dict[str, Warehouse] = {}
        for w in WAREHOUSES:
            wh = await upsert_warehouse(db, w)
            wh_map[w["name"]] = wh
        await db.flush()

        print("\n🏕️  Toplanma alanları yükleniyor…")
        for z in SAFE_ZONES:
            await upsert_safe_zone(db, z)
        await db.flush()

        print("\n📦 Malzemeler yükleniyor…")
        item_map: dict[str, Item] = {}
        for it in ITEMS:
            item = await upsert_item(db, it)
            item_map[it["sku"]] = item
        await db.flush()

        print("\n📊 Envanter yükleniyor…")
        for wh_name, stocks in INVENTORY.items():
            wh = wh_map[wh_name]
            cap = wh.capacity or 1
            for sku, qty in stocks.items():
                item = item_map[sku]
                await upsert_inventory(db, wh.id, item.id, qty)
                pct = qty / cap * 100
                flag = " ⚠️  DÜŞÜK STOK" if pct < 20 else ""
                print(f"  {wh_name[:35]:35s} | {item.name:20s} | {qty:6d} ({pct:.0f}%){flag}")

        await db.commit()
        print("\n✅ Pilot seed tamamlandı!\n")


if __name__ == "__main__":
    asyncio.run(seed())
