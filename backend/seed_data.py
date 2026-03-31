import asyncio
import aiosqlite
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import AsyncSessionLocal
from app.models.warehouse import Warehouse
from app.models.safe_zone import SafeZone

WAREHOUSES = [
    {"name": "Kadıköy Merkez Depo", "address": "Bahariye Cad. 45, Kadıköy, İstanbul", "capacity": 5000, "status": "active", "lon": 29.023, "lat": 40.991},
    {"name": "Beşiktaş Lojistik Depo", "address": "Barbaros Bulvarı 12, Beşiktaş, İstanbul", "capacity": 3000, "status": "active", "lon": 29.009, "lat": 41.043},
    {"name": "Üsküdar Yedek Depo", "address": "Hakimiyet Cad. 8, Üsküdar, İstanbul", "capacity": 2000, "status": "active", "lon": 29.015, "lat": 41.023},
    {"name": "Bakırköy Acil Depo", "address": "İstasyon Cad. 3, Bakırköy, İstanbul", "capacity": 4000, "status": "active", "lon": 28.877, "lat": 40.982},
]

SAFE_ZONES = [
    {"name": "Taksim Meydanı Toplanma Alanı", "capacity": 5000, "minLon": 28.975, "maxLon": 28.982, "minLat": 41.036, "maxLat": 41.041},
    {"name": "Kadıköy Moda Parkı", "capacity": 3000, "minLon": 29.018, "maxLon": 29.025, "minLat": 40.983, "maxLat": 40.988},
    {"name": "Beşiktaş Sahil Alanı", "capacity": 4000, "minLon": 29.002, "maxLon": 29.010, "minLat": 41.040, "maxLat": 41.046},
    {"name": "Üsküdar Meydan", "capacity": 2500, "minLon": 29.012, "maxLon": 29.018, "minLat": 41.021, "maxLat": 41.026},
    {"name": "Fatih Sultan Mehmet Parkı", "capacity": 3500, "minLon": 28.950, "maxLon": 28.957, "minLat": 41.008, "maxLat": 41.013},
    {"name": "Şişli Abide Meydanı", "capacity": 2000, "minLon": 28.985, "maxLon": 28.992, "minLat": 41.059, "maxLat": 41.064},
    {"name": "Maltepe Sahil Parkı", "capacity": 6000, "minLon": 29.128, "maxLon": 29.136, "minLat": 40.933, "maxLat": 40.938},
    {"name": "Pendik Toplanma Alanı", "capacity": 4000, "minLon": 29.228, "maxLon": 29.236, "minLat": 40.876, "maxLat": 40.881},
    {"name": "Ataşehir Meydan", "capacity": 3000, "minLon": 29.118, "maxLon": 29.125, "minLat": 40.991, "maxLat": 40.996},
    {"name": "Kartal Sahil", "capacity": 3500, "minLon": 29.188, "maxLon": 29.196, "minLat": 40.908, "maxLat": 40.913},
    {"name": "Bağcılar Meydan", "capacity": 2500, "minLon": 28.856, "maxLon": 28.863, "minLat": 41.036, "maxLat": 41.041},
    {"name": "Bahçelievler Parkı", "capacity": 2000, "minLon": 28.862, "maxLon": 28.869, "minLat": 41.000, "maxLat": 41.005},
    {"name": "Güngören Meydan", "capacity": 1500, "minLon": 28.876, "maxLon": 28.883, "minLat": 41.018, "maxLat": 41.023},
    {"name": "Esenler Toplanma Noktası", "capacity": 2000, "minLon": 28.876, "maxLon": 28.883, "minLat": 41.041, "maxLat": 41.046},
    {"name": "Eyüpsultan Sahası", "capacity": 3000, "minLon": 28.928, "maxLon": 28.935, "minLat": 41.055, "maxLat": 41.060},
    {"name": "Sarıyer Kuzey Alanı", "capacity": 2500, "minLon": 29.008, "maxLon": 29.015, "minLat": 41.166, "maxLat": 41.171},
    {"name": "Zeytinburnu Sahil", "capacity": 3000, "minLon": 28.905, "maxLon": 28.912, "minLat": 40.996, "maxLat": 41.001},
    {"name": "Avcılar Toplanma Alanı", "capacity": 2500, "minLon": 28.722, "maxLon": 28.729, "minLat": 40.978, "maxLat": 40.983},
    {"name": "Büyükçekmece Sahili", "capacity": 4000, "minLon": 28.578, "maxLon": 28.586, "minLat": 41.018, "maxLat": 41.023},
    {"name": "Silivri Meydan", "capacity": 3000, "minLon": 28.248, "maxLon": 28.256, "minLat": 41.071, "maxLat": 41.076},
]


async def seed():
    async with AsyncSessionLocal() as db:
        for w in WAREHOUSES:
            warehouse = Warehouse(
                name=w["name"],
                address=w["address"],
                capacity=w["capacity"],
                status=w["status"],
                data={"location": {"lon": w["lon"], "lat": w["lat"]}}
            )
            db.add(warehouse)

        for z in SAFE_ZONES:
            zone = SafeZone(
                name=z["name"],
                capacity=z["capacity"],
                status="active",
                data={"bounds": {
                    "minLon": z["minLon"],
                    "maxLon": z["maxLon"],
                    "minLat": z["minLat"],
                    "maxLat": z["maxLat"]
                }}
            )
            db.add(zone)

        await db.commit()
        print("✅ 4 depo ve 20 toplanma noktası eklendi!")


asyncio.run(seed())