"""
GeoSafe Backend Load Test
Kullanim: PYTHONPATH=. python scripts/load_test.py
Bagimlilik: httpx (zaten requirements.txt'te mevcut)
"""

import asyncio
import sys
import time
import statistics
from typing import NamedTuple

# Windows terminal UTF-8 uyumu
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

try:
    import httpx
except ImportError:
    raise SystemExit("httpx kurulu değil. pip install httpx")

BASE_URL = "http://localhost:8000"

SCENARIOS = [
    {
        "name": "GET /health (baseline)",
        "url": f"{BASE_URL}/health",
        "concurrency": 100,
    },
    {
        "name": "GET /api/v1/warehouses",
        "url": f"{BASE_URL}/api/v1/warehouses",
        "concurrency": 100,
    },
    {
        "name": "GET /api/v1/spatial/nearest-depot (battaniye)",
        "url": (
            f"{BASE_URL}/api/v1/spatial/nearest-depot"
            "?lat=41.01&lon=28.97&item_name=battaniye&radius_km=15"
        ),
        "concurrency": 50,
    },
]


class RequestResult(NamedTuple):
    status: int
    elapsed_ms: float


async def single_request(client: httpx.AsyncClient, url: str) -> RequestResult:
    t0 = time.perf_counter()
    try:
        resp = await client.get(url, timeout=15.0)
        elapsed = (time.perf_counter() - t0) * 1000
        return RequestResult(status=resp.status_code, elapsed_ms=elapsed)
    except Exception as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        return RequestResult(status=0, elapsed_ms=elapsed)


async def run_scenario(name: str, url: str, concurrency: int) -> None:
    print(f"\n{'─' * 60}")
    print(f"  Senaryo : {name}")
    print(f"  URL     : {url}")
    print(f"  Eş-zamanlı istek: {concurrency}")
    print(f"{'─' * 60}")

    async with httpx.AsyncClient() as client:
        wall_start = time.perf_counter()
        tasks = [single_request(client, url) for _ in range(concurrency)]
        results: list[RequestResult] = await asyncio.gather(*tasks)
        wall_elapsed = time.perf_counter() - wall_start

    latencies = [r.elapsed_ms for r in results]
    success = [r for r in results if 200 <= r.status < 300]
    failed  = [r for r in results if r.status < 200 or r.status >= 300]

    rps = concurrency / wall_elapsed if wall_elapsed > 0 else 0

    print(f"  Toplam süre        : {wall_elapsed * 1000:.1f} ms")
    print(f"  Ortalama gecikme   : {statistics.mean(latencies):.1f} ms")
    print(f"  Min gecikme        : {min(latencies):.1f} ms")
    print(f"  Max gecikme        : {max(latencies):.1f} ms")
    if len(latencies) >= 2:
        print(f"  Std sapma          : {statistics.stdev(latencies):.1f} ms")
    print(f"  Başarılı istek     : {len(success)} / {concurrency}")
    print(f"  Başarısız istek    : {len(failed)}")
    print(f"  RPS (saniye başına): {rps:.1f}")

    if failed:
        status_counts: dict[int, int] = {}
        for r in failed:
            status_counts[r.status] = status_counts.get(r.status, 0) + 1
        print(f"  Hata dagilimu      : {status_counts}")
        if status_counts.get(500, 0) > 0:
            print("  NOT: 500 hatalari PostGIS gerektiren sorgular icin beklenen davranistir.")
            print("       SQLite ortaminda ST_DWithin/AsEWKB desteklenmez.")
            print("       Sureleri ve RPS degerleri yine de gecerlidir.")


async def check_health() -> bool:
    print(f"  Sunucu sağlık kontrolü → {BASE_URL}/health …", end=" ", flush=True)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{BASE_URL}/health", timeout=5.0)
            ok = resp.status_code == 200
            print("✅ OK" if ok else f"❌ HTTP {resp.status_code}")
            return ok
        except Exception as exc:
            print(f"❌ Bağlanamadı: {exc}")
            return False


async def main() -> None:
    print("\n" + "═" * 60)
    print("  GeoSafe Backend Load Test")
    print("═" * 60)

    healthy = await check_health()
    if not healthy:
        print("\n⚠️  Sunucu yanıt vermiyor. Testi durduruluyor.")
        print("    Backend'i başlatmak için: uvicorn app.main:app --reload")
        return

    for scenario in SCENARIOS:
        await run_scenario(**scenario)

    print("\n" + "═" * 60)
    print("  Load test tamamlandı.")
    print("═" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
