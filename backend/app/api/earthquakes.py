from fastapi import APIRouter
import httpx
from datetime import datetime, timedelta
from app.api.response import success_response

router = APIRouter(tags=["earthquakes"])

@router.get("")
async def get_earthquakes():
    try:
        all_results = []
        fetch_errors = []
        async with httpx.AsyncClient(timeout=15) as client:
            for i in range(3):
                date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
                try:
                    response = await client.get(
                        f"https://api.orhanaydogdu.com.tr/deprem/kandilli/archive?date={date}&limit=500"
                    )
                    response.raise_for_status()
                    data = response.json()
                    all_results.extend(data.get("result", []))
                except Exception as exc:
                    fetch_errors.append(f"{date}: {str(exc)}")
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
            except (KeyError, TypeError, ValueError):
                continue

        filtered.sort(key=lambda x: x["date"], reverse=True)
        return success_response(
            data={"result": filtered, "partial_errors": fetch_errors},
            message="Earthquake feed fetched"
        )
    except Exception as e:
        return {
            "status": "error",
            "data": {"result": []},
            "message": f"Earthquake feed failed: {str(e)}"
        }