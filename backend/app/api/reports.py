"""
Exportable reports — GS-082.

GET /api/v1/reports/inventory.csv   — full inventory as CSV (admin)
GET /api/v1/reports/inventory.pdf   — full inventory as PDF (admin)
GET /api/v1/reports/movements.csv   — inventory movements as CSV (admin)
GET /api/v1/reports/checkins.csv    — safe check-ins as CSV (admin)
"""

import csv
import io
import textwrap
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.inventory import DEFAULT_LOW_STOCK_THRESHOLD
from app.db import get_db
from app.models.inventory_movement import InventoryMovement
from app.models.item import Item
from app.models.safe_checkin import SafeCheckin
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.warehouse_inventory import WarehouseInventory

router = APIRouter(tags=["reports"])


def _csv_response(rows: list[list], headers: list[str], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _pdf_table(title: str, headers: list[str], rows: list[list]) -> bytes:
    """
    Minimal PDF built with plain bytes — no external library required.
    Produces a basic table; for richer PDF use reportlab or weasyprint.
    """
    # Use HTML → PDF via weasyprint if available, else fall back to CSV download
    try:
        from weasyprint import HTML  # type: ignore

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        th = "".join(f"<th>{h}</th>" for h in headers)
        body_rows = "".join(
            "<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>"
            for row in rows
        )
        html = textwrap.dedent(f"""
            <!DOCTYPE html>
            <html><head>
            <meta charset="utf-8">
            <style>
              body {{ font-family: sans-serif; font-size: 11px; margin: 20px; }}
              h1 {{ font-size: 16px; }}
              table {{ border-collapse: collapse; width: 100%; }}
              th {{ background: #1565c0; color: #fff; padding: 6px 8px; text-align: left; }}
              td {{ padding: 5px 8px; border-bottom: 1px solid #ddd; }}
              tr:nth-child(even) td {{ background: #f5f5f5; }}
              .meta {{ color: #666; font-size: 10px; margin-bottom: 12px; }}
            </style>
            </head><body>
            <h1>{title}</h1>
            <p class="meta">Oluşturuldu: {now} — GeoSafe Rapor Sistemi</p>
            <table><thead><tr>{th}</tr></thead><tbody>{body_rows}</tbody></table>
            </body></html>
        """)
        return HTML(string=html).write_pdf()
    except ImportError:
        return b""


# ── Inventory CSV / PDF ───────────────────────────────────────────────────────

async def _inventory_rows(db: AsyncSession) -> tuple[list[str], list[list]]:
    headers = ["Depo", "Malzeme", "SKU", "Birim", "Miktar", "Eşik", "Kritik mi?", "Tarih"]
    stmt = (
        select(
            Warehouse.name.label("warehouse_name"),
            Item.name.label("item_name"),
            Item.sku,
            Item.unit,
            Item.low_stock_threshold,
            WarehouseInventory.quantity,
            WarehouseInventory.last_updated,
        )
        .join(WarehouseInventory, WarehouseInventory.warehouse_id == Warehouse.id)
        .join(Item, Item.id == WarehouseInventory.item_id)
        .order_by(Warehouse.name, Item.name)
    )
    result = await db.execute(stmt)
    rows = []
    for r in result.all():
        threshold = r.low_stock_threshold if r.low_stock_threshold is not None else DEFAULT_LOW_STOCK_THRESHOLD
        rows.append([
            r.warehouse_name,
            r.item_name,
            r.sku,
            r.unit,
            r.quantity,
            threshold,
            "Evet" if r.quantity <= threshold else "Hayır",
            r.last_updated.strftime("%Y-%m-%d %H:%M") if r.last_updated else "",
        ])
    return headers, rows


@router.get("/inventory.csv")
async def export_inventory_csv(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    headers, rows = await _inventory_rows(db)
    date = datetime.utcnow().strftime("%Y%m%d")
    return _csv_response(rows, headers, f"geosafe-inventory-{date}.csv")


@router.get("/inventory.pdf")
async def export_inventory_pdf(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    headers, rows = await _inventory_rows(db)
    date = datetime.utcnow().strftime("%Y%m%d")
    pdf_bytes = _pdf_table("Envanter Raporu", headers, rows)
    if not pdf_bytes:
        # weasyprint not installed — return CSV instead
        return _csv_response(rows, headers, f"geosafe-inventory-{date}.csv")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="geosafe-inventory-{date}.pdf"'},
    )


# ── Inventory movements CSV ───────────────────────────────────────────────────

@router.get("/movements.csv")
async def export_movements_csv(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    stmt = (
        select(InventoryMovement)
        .order_by(InventoryMovement.timestamp.desc())
        .limit(5000)
    )
    result = await db.execute(stmt)
    movements = result.scalars().all()

    headers = ["ID", "Malzeme ID", "Miktar", "Kaynak Depo", "Hedef Depo", "Tür", "Zaman", "Not"]
    rows = [
        [
            m.id,
            m.item_id,
            m.quantity,
            m.from_warehouse_id or "",
            m.to_warehouse_id or "",
            m.movement_type,
            m.timestamp.strftime("%Y-%m-%d %H:%M") if m.timestamp else "",
            m.note or "",
        ]
        for m in movements
    ]
    date = datetime.utcnow().strftime("%Y%m%d")
    return _csv_response(rows, headers, f"geosafe-movements-{date}.csv")


# ── Check-in CSV ──────────────────────────────────────────────────────────────

@router.get("/checkins.csv")
async def export_checkins_csv(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    stmt = select(SafeCheckin).order_by(SafeCheckin.created_at.desc()).limit(10000)
    result = await db.execute(stmt)
    checkins = result.scalars().all()

    headers = ["ID", "Kullanıcı ID", "İsim", "Enlem", "Boylam", "Not", "Kaynak", "Tarih"]
    rows = [
        [
            c.id,
            c.user_id or "",
            c.name or "",
            c.lat or "",
            c.lon or "",
            c.note or "",
            c.source,
            c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else "",
        ]
        for c in checkins
    ]
    date = datetime.utcnow().strftime("%Y%m%d")
    return _csv_response(rows, headers, f"geosafe-checkins-{date}.csv")
