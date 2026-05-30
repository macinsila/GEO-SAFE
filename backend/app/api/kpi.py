"""
GS-080: KPI summary endpoint.

GET /api/v1/kpi/summary  — aggregated operational metrics for the dashboard.
Accessible to any authenticated user; the response is the same for all roles
(admin-only breakdowns are omitted to keep the shape consistent).
"""

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.response import success_response
from app.db import get_db
from app.models.emergency_report import EmergencyReport
from app.models.item import Item
from app.models.safe_zone import SafeZone
from app.models.user import User
from app.models.volunteer_application import VolunteerApplication
from app.models.volunteer_task import VolunteerTask
from app.models.warehouse import Warehouse
from app.models.warehouse_inventory import WarehouseInventory

router = APIRouter(tags=["kpi"])


@router.get("/summary")
async def get_kpi_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # ── Emergencies ────────────────────────────────────────────────────────────
    em_total = (await db.execute(select(func.count(EmergencyReport.id)))).scalar_one()
    em_new = (
        await db.execute(
            select(func.count(EmergencyReport.id)).where(EmergencyReport.status == "new")
        )
    ).scalar_one()
    em_resolved = (
        await db.execute(
            select(func.count(EmergencyReport.id)).where(
                EmergencyReport.status.in_(["resolved", "dismissed"])
            )
        )
    ).scalar_one()

    # ── Volunteer tasks ────────────────────────────────────────────────────────
    task_total = (await db.execute(select(func.count(VolunteerTask.id)))).scalar_one()
    task_open = (
        await db.execute(
            select(func.count(VolunteerTask.id)).where(VolunteerTask.status == "open")
        )
    ).scalar_one()
    task_done = (
        await db.execute(
            select(func.count(VolunteerTask.id)).where(VolunteerTask.status == "done")
        )
    ).scalar_one()

    # ── Warehouses ────────────────────────────────────────────────────────────
    wh_total = (await db.execute(select(func.count(Warehouse.id)))).scalar_one()
    wh_active = (
        await db.execute(
            select(func.count(Warehouse.id)).where(Warehouse.status == "active")
        )
    ).scalar_one()

    # ── Safe zones ────────────────────────────────────────────────────────────
    sz_total = (await db.execute(select(func.count(SafeZone.id)))).scalar_one()
    sz_active = (
        await db.execute(
            select(func.count(SafeZone.id)).where(SafeZone.status == "active")
        )
    ).scalar_one()
    sz_capacity = (
        await db.execute(select(func.coalesce(func.sum(SafeZone.capacity), 0)))
    ).scalar_one()

    # ── Critical stock ────────────────────────────────────────────────────────
    # Items whose current quantity is at or below low_stock_threshold
    critical_rows = (
        await db.execute(
            select(func.count(WarehouseInventory.id))
            .join(Item, Item.id == WarehouseInventory.item_id)
            .where(
                and_(
                    Item.is_active.is_(True),
                    Item.low_stock_threshold.isnot(None),
                    WarehouseInventory.quantity <= Item.low_stock_threshold,
                )
            )
        )
    ).scalar_one()

    # ── Volunteer applications ─────────────────────────────────────────────────
    vol_pending = (
        await db.execute(
            select(func.count(VolunteerApplication.id)).where(
                VolunteerApplication.status == "pending"
            )
        )
    ).scalar_one()

    return success_response(
        data={
            "emergencies": {
                "total": em_total,
                "new": em_new,
                "resolved": em_resolved,
            },
            "tasks": {
                "total": task_total,
                "open": task_open,
                "done": task_done,
            },
            "warehouses": {
                "total": wh_total,
                "active": wh_active,
            },
            "safe_zones": {
                "total": sz_total,
                "active": sz_active,
                "total_capacity": int(sz_capacity),
            },
            "critical_stock_count": critical_rows,
            "volunteer_applications_pending": vol_pending,
        },
        message="KPI özeti alındı",
    )
