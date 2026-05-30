"""
GS-061: Bulk import of warehouses and safe zones.

Accepts a JSON array of rows, validates each, and idempotently upserts by name.
Supports ?dry_run=true to preview what would change without committing.

Returns an ImportReport: {created, updated, skipped, errors}.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from geoalchemy2 import WKTElement
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.response import success_response
from app.db import get_db
from app.models.safe_zone import SafeZone
from app.models.user import User
from app.models.warehouse import Warehouse

router = APIRouter(tags=["admin-import"])


# ── Input schemas ──────────────────────────────────────────────────────────────

class WarehouseImportRow(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    capacity: Optional[int] = Field(None, ge=0)
    status: str = Field("active", pattern=r"^(active|inactive|maintenance)$")

    @model_validator(mode="after")
    def lat_lon_both_or_neither(self):
        if (self.lat is None) != (self.lon is None):
            raise ValueError("lat and lon must both be provided or both omitted")
        return self


class SafeZoneImportRow(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    capacity: Optional[int] = Field(None, ge=0)
    capacity_type: str = Field("persons", max_length=50)
    status: str = Field("active", pattern=r"^(active|inactive|closed)$")
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)

    @model_validator(mode="after")
    def lat_lon_both_or_neither(self):
        if (self.lat is None) != (self.lon is None):
            raise ValueError("lat and lon must both be provided or both omitted")
        return self


# ── Output schema ──────────────────────────────────────────────────────────────

class ImportError(BaseModel):
    row: int
    name: str
    reason: str


class ImportReport(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: List[ImportError]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _point_wkt(lat: float, lon: float) -> WKTElement:
    return WKTElement(f"POINT({lon} {lat})", srid=4326)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/warehouses", response_model=None)
async def import_warehouses(
    rows: List[WarehouseImportRow],
    dry_run: bool = Query(False, description="Preview without committing"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """
    Idempotent bulk upsert of warehouses by name.
    Returns an ImportReport showing what was (or would be) created/updated/skipped.
    """
    if len(rows) > 500:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Maximum 500 rows per import request")

    report = ImportReport(created=0, updated=0, skipped=0, errors=[])

    for idx, row in enumerate(rows, start=1):
        try:
            result = await db.execute(select(Warehouse).where(Warehouse.name == row.name))
            existing = result.scalar_one_or_none()

            location = _point_wkt(row.lat, row.lon) if row.lat is not None else None

            if existing is None:
                if not dry_run:
                    wh = Warehouse(
                        name=row.name,
                        address=row.address,
                        location=location,
                        capacity=row.capacity,
                        status=row.status,
                    )
                    db.add(wh)
                report.created += 1
            else:
                changed = (
                    (row.address is not None and existing.address != row.address)
                    or location is not None
                    or (row.capacity is not None and existing.capacity != row.capacity)
                    or existing.status != row.status
                )
                if changed:
                    if not dry_run:
                        if row.address is not None:
                            existing.address = row.address
                        if location is not None:
                            existing.location = location
                        if row.capacity is not None:
                            existing.capacity = row.capacity
                        existing.status = row.status
                    report.updated += 1
                else:
                    report.skipped += 1
        except Exception as exc:
            report.errors.append(ImportError(row=idx, name=row.name, reason=str(exc)))

    if not dry_run and (report.created > 0 or report.updated > 0):
        await db.commit()

    return success_response(
        data=report.model_dump(),
        message=f"{'[DRY RUN] ' if dry_run else ''}Warehouse import: {report.created} created, {report.updated} updated, {report.skipped} skipped, {len(report.errors)} errors",
    )


@router.post("/safe-zones", response_model=None)
async def import_safe_zones(
    rows: List[SafeZoneImportRow],
    dry_run: bool = Query(False, description="Preview without committing"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """
    Idempotent bulk upsert of safe zones by name.
    Returns an ImportReport showing what was (or would be) created/updated/skipped.
    """
    if len(rows) > 500:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Maximum 500 rows per import request")

    report = ImportReport(created=0, updated=0, skipped=0, errors=[])

    for idx, row in enumerate(rows, start=1):
        try:
            result = await db.execute(select(SafeZone).where(SafeZone.name == row.name))
            existing = result.scalar_one_or_none()

            location = _point_wkt(row.lat, row.lon) if row.lat is not None else None

            if existing is None:
                if not dry_run:
                    sz = SafeZone(
                        name=row.name,
                        capacity=row.capacity,
                        capacity_type=row.capacity_type,
                        status=row.status,
                        location=location,
                    )
                    db.add(sz)
                report.created += 1
            else:
                changed = (
                    (row.capacity is not None and existing.capacity != row.capacity)
                    or existing.capacity_type != row.capacity_type
                    or existing.status != row.status
                    or location is not None
                )
                if changed:
                    if not dry_run:
                        if row.capacity is not None:
                            existing.capacity = row.capacity
                        existing.capacity_type = row.capacity_type
                        existing.status = row.status
                        if location is not None:
                            existing.location = location
                    report.updated += 1
                else:
                    report.skipped += 1
        except Exception as exc:
            report.errors.append(ImportError(row=idx, name=row.name, reason=str(exc)))

    if not dry_run and (report.created > 0 or report.updated > 0):
        await db.commit()

    return success_response(
        data=report.model_dump(),
        message=f"{'[DRY RUN] ' if dry_run else ''}Safe zone import: {report.created} created, {report.updated} updated, {report.skipped} skipped, {len(report.errors)} errors",
    )
