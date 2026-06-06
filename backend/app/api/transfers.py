"""
Inter-warehouse transfer request API — GS-052.

POST /api/v1/transfers              — request a transfer (operator/admin)
GET  /api/v1/transfers              — list transfers (operator/admin)
PATCH /api/v1/transfers/{id}/approve — approve and execute (admin)
PATCH /api/v1/transfers/{id}/reject  — reject (admin)
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_roles
from app.api.response import success_response
from app.core.audit import log_audit
from app.db import get_db
from app.models.inventory_movement import InventoryMovement
from app.models.transfer_request import TransferRequest
from app.models.user import User
from app.models.warehouse_inventory import WarehouseInventory

router = APIRouter(tags=["transfers"])


class TransferCreate(BaseModel):
    from_warehouse_id: int
    to_warehouse_id: int
    item_id: int
    quantity: int = Field(..., gt=0)
    note: Optional[str] = None


class TransferResponse(BaseModel):
    id: int
    from_warehouse_id: int
    to_warehouse_id: int
    item_id: int
    quantity: int
    requested_by: Optional[int]
    approved_by: Optional[int]
    status: str
    note: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Create ───────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_transfer(
    payload: TransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    if payload.from_warehouse_id == payload.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Kaynak ve hedef depo aynı olamaz")

    # Verify source has enough stock
    result = await db.execute(
        select(WarehouseInventory).where(
            WarehouseInventory.warehouse_id == payload.from_warehouse_id,
            WarehouseInventory.item_id == payload.item_id,
        )
    )
    src_inv = result.scalar_one_or_none()
    if not src_inv or src_inv.quantity < payload.quantity:
        available = src_inv.quantity if src_inv else 0
        raise HTTPException(
            status_code=422,
            detail=f"Kaynak depoda yetersiz stok: mevcut {available}, istenen {payload.quantity}",
        )

    transfer = TransferRequest(
        from_warehouse_id=payload.from_warehouse_id,
        to_warehouse_id=payload.to_warehouse_id,
        item_id=payload.item_id,
        quantity=payload.quantity,
        requested_by=current_user.id,
        note=payload.note,
    )
    db.add(transfer)
    await db.flush()
    transfer_id = transfer.id
    await db.commit()
    result = await db.execute(select(TransferRequest).where(TransferRequest.id == transfer_id))
    transfer = result.scalar_one()
    return success_response(
        data=TransferResponse.model_validate(transfer).model_dump(),
        message="Transfer talebi oluşturuldu",
    )


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_transfers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "operator")),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    stmt = select(TransferRequest).order_by(TransferRequest.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(TransferRequest.status == status)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return success_response(
        data=[TransferResponse.model_validate(t).model_dump() for t in items],
        message=f"{len(items)} transfer talebi",
    )


# ── Approve (executes inventory movement) ────────────────────────────────────

@router.patch("/{transfer_id}/approve")
async def approve_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(
        select(TransferRequest).where(TransferRequest.id == transfer_id)
    )
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer talebi bulunamadı")
    if transfer.status != "pending":
        raise HTTPException(status_code=400, detail=f"Talep zaten '{transfer.status}' durumunda")

    # Deduct from source
    src_result = await db.execute(
        select(WarehouseInventory).where(
            WarehouseInventory.warehouse_id == transfer.from_warehouse_id,
            WarehouseInventory.item_id == transfer.item_id,
        )
    )
    src_inv = src_result.scalar_one_or_none()
    if not src_inv or src_inv.quantity < transfer.quantity:
        raise HTTPException(status_code=422, detail="Kaynak depoda artık yeterli stok yok")
    src_inv.quantity -= transfer.quantity

    # Add to destination
    dst_result = await db.execute(
        select(WarehouseInventory).where(
            WarehouseInventory.warehouse_id == transfer.to_warehouse_id,
            WarehouseInventory.item_id == transfer.item_id,
        )
    )
    dst_inv = dst_result.scalar_one_or_none()
    if dst_inv:
        dst_inv.quantity += transfer.quantity
    else:
        db.add(WarehouseInventory(
            warehouse_id=transfer.to_warehouse_id,
            item_id=transfer.item_id,
            quantity=transfer.quantity,
        ))

    # Log the movement
    db.add(InventoryMovement(
        item_id=transfer.item_id,
        quantity=transfer.quantity,
        from_warehouse_id=transfer.from_warehouse_id,
        to_warehouse_id=transfer.to_warehouse_id,
        movement_type="transfer",
        performed_by=current_user.id,
        note=f"Transfer #{transfer_id} onaylandı",
    ))

    transfer.status = "completed"
    transfer.approved_by = current_user.id
    await log_audit(db, "approve", "transfer", transfer_id, new_value={"status": "completed"}, actor=current_user)
    await db.commit()
    return success_response(
        data={"transfer_id": transfer_id, "status": "completed"},
        message="Transfer onaylandı ve envanter güncellendi",
    )


# ── Reject ────────────────────────────────────────────────────────────────────

@router.patch("/{transfer_id}/reject")
async def reject_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(
        select(TransferRequest).where(TransferRequest.id == transfer_id)
    )
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer talebi bulunamadı")
    if transfer.status != "pending":
        raise HTTPException(status_code=400, detail=f"Talep zaten '{transfer.status}' durumunda")

    transfer.status = "rejected"
    transfer.approved_by = current_user.id
    await log_audit(db, "reject", "transfer", transfer_id, new_value={"status": "rejected"}, actor=current_user)
    await db.commit()
    return success_response(
        data={"transfer_id": transfer_id, "status": "rejected"},
        message="Transfer reddedildi",
    )
