from fastapi import APIRouter
import httpx
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/earthquakes", tags=["earthquakes"])

@router.get("")
async def get_earthquakes():
    try:
        all_results = []
        async with httpx.AsyncClient(timeout=15) as client:
            for i in range(3):
                date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
                try:
                    response = await client.get(
                        f"https://api.orhanaydogdu.com.tr/deprem/kandilli/archive?date={date}&limit=500"
                    )
                    data = response.json()
                    all_results.extend(data.get("result", []))
                except:
                    continue

        three_days_ago = datetime.now() - timedelta(days=3)
        filtered = []

        for eq in all_results:
            try:
                mag = float(eq["mag"])
                eq_date = datetime.strptime(eq["date_time"], "%Y-%m-%d %H:%M:%S")
                if mag >= 3.5 and eq_date >= three_days_ago:
                    filtered.append({
                        "mag": mag,
                        "title": eq["title"],
                        "date": eq["date_time"],
                        "depth": eq["depth"]
                    })
            except:
                continue

        filtered.sort(key=lambda x: x["date"], reverse=True)
        return {"result": filtered}
    except Exception as e:
        return {"result": [], "error": str(e)}