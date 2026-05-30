from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlalchemy.orm.attributes import flag_modified

from app.api import sse as sse_broadcaster
from app.api.auth import require_roles
from app.api.response import success_response
from app.db import get_db
from app.models.inventory_movement import InventoryMovement
from app.models.item import Item
from app.models.safe_zone import SafeZone
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.warehouse_inventory import WarehouseInventory
from app.schemas import ItemCreate, ItemUpdate, WarehouseInventoryAdminUpdate


router = APIRouter(tags=["inventory"])

DEFAULT_LOW_STOCK_THRESHOLD = 10


class StokGuncelle(BaseModel):
    water: Optional[str] = "-"
    food: Optional[str] = "-"
    med: Optional[str] = "-"
    blanket: Optional[int] = Field(default=0, ge=0)
    ext: Optional[int] = Field(default=0, ge=0)


def _item_threshold(item: Item) -> int:
    return item.low_stock_threshold if item.low_stock_threshold is not None else DEFAULT_LOW_STOCK_THRESHOLD


def _serialize_item(item: Item) -> dict:
    return {
        "id": item.id,
        "sku": item.sku,
        "name": item.name,
        "description": item.description,
        "unit": item.unit,
        "low_stock_threshold": item.low_stock_threshold,
        "is_active": item.is_active,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


async def _resolve_item(db: AsyncSession, item_id: int) -> Item:
    result = await db.execute(select(Item).where(Item.id == item_id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
    return item


async def _resolve_warehouse(db: AsyncSession, warehouse_id: int) -> Warehouse:
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if warehouse is None:
        raise HTTPException(status_code=404, detail=f"Warehouse {warehouse_id} not found")
    return warehouse


async def _performed_by_id(db: AsyncSession, current_user: User) -> Optional[int]:
    result = await db.execute(select(User.id).where(User.id == current_user.id))
    return result.scalar_one_or_none()


async def _upsert_warehouse_inventory(
    *,
    db: AsyncSession,
    warehouse_id: int,
    item_id: int,
    quantity: int,
    movement_type: str,
    note: Optional[str],
    current_user: User,
) -> dict:
    warehouse = await _resolve_warehouse(db, warehouse_id)
    item = await _resolve_item(db, item_id)

    result = await db.execute(
        select(WarehouseInventory).where(
            and_(
                WarehouseInventory.warehouse_id == warehouse_id,
                WarehouseInventory.item_id == item_id,
            )
        )
    )
    inventory = result.scalar_one_or_none()
    old_quantity = inventory.quantity if inventory is not None else 0

    if inventory is None:
        inventory = WarehouseInventory(
            warehouse_id=warehouse_id,
            item_id=item_id,
            quantity=quantity,
        )
        db.add(inventory)
    else:
        inventory.quantity = quantity

    quantity_change = quantity - old_quantity
    db.add(
        InventoryMovement(
            item_id=item_id,
            quantity=quantity_change,
            to_warehouse_id=warehouse_id,
            movement_type=movement_type,
            performed_by=await _performed_by_id(db, current_user),
            note=note,
            data={
                "previous_quantity": old_quantity,
                "new_quantity": quantity,
                "warehouse_name": warehouse.name,
                "item_name": item.name,
            },
        )
    )
    await db.flush()

    threshold = _item_threshold(item)
    is_critical = inventory.quantity <= threshold
    result_data = {
        "warehouse_id": warehouse.id,
        "warehouse_name": warehouse.name,
        "item_id": item.id,
        "item_name": item.name,
        "item_sku": item.sku,
        "item_unit": item.unit,
        "quantity": inventory.quantity,
        "threshold": threshold,
        "is_critical": is_critical,
    }

    # GS-081: broadcast low-stock alert via SSE when quantity drops at/below threshold
    if is_critical:
        await sse_broadcaster.broadcast_low_stock_alert({
            **result_data,
            "message": (
                f"Düşük stok uyarısı: {warehouse.name} deposunda "
                f"{item.name} ({inventory.quantity} {item.unit}) — eşik: {threshold}"
            ),
        })

    # GS-022: broadcast every inventory change so the live logistics dashboard refreshes
    await sse_broadcaster.broadcast_inventory_update(result_data)

    return result_data


@router.get("/safe-zone/{zone_id}")
async def stok_getir(zone_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Bolge bulunamadi")

    data = zone.data or {}
    return success_response(
        data={
            "zone_id": zone_id,
            "name": zone.name,
            "water": data.get("water", "-"),
            "food": data.get("food", "-"),
            "med": data.get("med", "-"),
            "blanket": data.get("blanket", 0),
            "ext": data.get("ext", 0),
        },
        message="Inventory fetched",
    )


@router.put("/safe-zone/{zone_id}")
async def stok_guncelle(
    zone_id: int,
    payload: StokGuncelle,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    stmt = select(SafeZone).where(SafeZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Bolge bulunamadi")

    new_data = dict(zone.data or {})
    new_data["water"] = payload.water
    new_data["food"] = payload.food
    new_data["med"] = payload.med
    new_data["blanket"] = payload.blanket
    new_data["ext"] = payload.ext
    zone.data = new_data
    flag_modified(zone, "data")

    await db.commit()
    await db.refresh(zone)
    return success_response(data={"zone_id": zone_id}, message="Stok guncellendi")


@router.get("/items/admin")
async def list_inventory_items_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(select(Item).order_by(Item.is_active.desc(), Item.name.asc()))
    items = result.scalars().all()
    return success_response(
        data=[_serialize_item(item) for item in items],
        message="Inventory items listed",
    )


@router.post("/items/admin", status_code=201)
async def create_inventory_item_admin(
    payload: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    existing = await db.execute(
        select(Item).where(or_(Item.sku == payload.sku, Item.name == payload.name))
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Item with the same sku or name already exists")

    item = Item(
        sku=payload.sku,
        name=payload.name,
        description=payload.description,
        unit=payload.unit,
        low_stock_threshold=payload.low_stock_threshold,
        is_active=payload.is_active,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    await db.commit()
    return success_response(data=_serialize_item(item), message="Inventory item created")


@router.patch("/items/admin/{item_id}")
async def update_inventory_item_admin(
    item_id: int,
    payload: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    item = await _resolve_item(db, item_id)
    updates = payload.model_dump(exclude_unset=True)

    if "sku" in updates and updates["sku"] != item.sku:
        existing = await db.execute(select(Item).where(Item.sku == updates["sku"], Item.id != item_id))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Item sku already exists")

    if "name" in updates and updates["name"] != item.name:
        existing = await db.execute(select(Item).where(Item.name == updates["name"], Item.id != item_id))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Item name already exists")

    for field, value in updates.items():
        setattr(item, field, value)

    await db.flush()
    await db.refresh(item)
    await db.commit()
    return success_response(data=_serialize_item(item), message="Inventory item updated")


@router.delete("/items/admin/{item_id}")
async def delete_inventory_item_admin(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    item = await _resolve_item(db, item_id)

    has_links = await db.execute(
        select(WarehouseInventory.id)
        .where(WarehouseInventory.item_id == item_id)
        .limit(1)
    )
    has_movements = await db.execute(
        select(InventoryMovement.id)
        .where(InventoryMovement.item_id == item_id)
        .limit(1)
    )

    if has_links.scalar_one_or_none() is not None or has_movements.scalar_one_or_none() is not None:
        item.is_active = False
        await db.commit()
        return success_response(
            data={"id": item_id, "deleted": False, "is_active": False},
            message="Inventory item deactivated because it has related inventory history",
        )

    await db.delete(item)
    await db.commit()
    return success_response(data={"id": item_id, "deleted": True}, message="Inventory item deleted")


@router.get("/warehouses/admin")
async def list_warehouse_inventory_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    stmt = (
        select(
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            Item.id.label("item_id"),
            Item.name.label("item_name"),
            Item.sku.label("item_sku"),
            Item.unit.label("item_unit"),
            Item.low_stock_threshold.label("item_threshold"),
            WarehouseInventory.quantity.label("quantity"),
        )
        .join(WarehouseInventory, WarehouseInventory.warehouse_id == Warehouse.id)
        .join(Item, Item.id == WarehouseInventory.item_id)
        .order_by(Warehouse.name.asc(), Item.name.asc())
    )
    rows = (await db.execute(stmt)).all()
    data = [
        {
            "warehouse_id": row.warehouse_id,
            "warehouse_name": row.warehouse_name,
            "item_id": row.item_id,
            "item_name": row.item_name,
            "item_sku": row.item_sku,
            "item_unit": row.item_unit,
            "quantity": row.quantity,
            "threshold": row.item_threshold if row.item_threshold is not None else DEFAULT_LOW_STOCK_THRESHOLD,
            "is_critical": row.quantity
            <= (row.item_threshold if row.item_threshold is not None else DEFAULT_LOW_STOCK_THRESHOLD),
        }
        for row in rows
    ]
    return success_response(data=data, message="Warehouse inventory listed")


@router.patch("/warehouses/admin/{warehouse_id}/items/{item_id}")
async def update_warehouse_inventory_admin(
    warehouse_id: int,
    item_id: int,
    payload: WarehouseInventoryAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    row = await _upsert_warehouse_inventory(
        db=db,
        warehouse_id=warehouse_id,
        item_id=item_id,
        quantity=payload.quantity,
        movement_type=payload.movement_type,
        note=payload.note or "Warehouse inventory adjusted by admin",
        current_user=current_user,
    )
    await db.commit()
    return success_response(data=row, message="Warehouse inventory updated")


@router.get("/movements/admin")
async def list_inventory_movements_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    source_warehouse = aliased(Warehouse)
    target_warehouse = aliased(Warehouse)
    actor = aliased(User)

    stmt = (
        select(
            InventoryMovement,
            Item.name.label("item_name"),
            Item.sku.label("item_sku"),
            source_warehouse.id.label("from_warehouse_id"),
            source_warehouse.name.label("from_warehouse_name"),
            target_warehouse.id.label("to_warehouse_id"),
            target_warehouse.name.label("to_warehouse_name"),
            actor.id.label("actor_id"),
            actor.name.label("actor_name"),
            actor.role.label("actor_role"),
        )
        .join(Item, Item.id == InventoryMovement.item_id)
        .outerjoin(source_warehouse, source_warehouse.id == InventoryMovement.from_warehouse_id)
        .outerjoin(target_warehouse, target_warehouse.id == InventoryMovement.to_warehouse_id)
        .outerjoin(actor, actor.id == InventoryMovement.performed_by)
        .order_by(InventoryMovement.timestamp.desc(), InventoryMovement.id.desc())
    )
    rows = (await db.execute(stmt)).all()
    data = []
    for row in rows:
        movement = row.InventoryMovement
        old_quantity = None
        new_quantity = None
        if isinstance(movement.data, dict):
            old_quantity = movement.data.get("previous_quantity")
            new_quantity = movement.data.get("new_quantity")

        data.append(
            {
                "id": movement.id,
                "warehouse_id": row.to_warehouse_id or row.from_warehouse_id,
                "warehouse_name": row.to_warehouse_name or row.from_warehouse_name,
                "item_id": movement.item_id,
                "item_name": row.item_name,
                "item_sku": row.item_sku,
                "quantity_change": movement.quantity,
                "old_quantity": old_quantity,
                "new_quantity": new_quantity,
                "movement_type": movement.movement_type,
                "note": movement.note,
                "created_at": movement.timestamp,
                "actor_id": row.actor_id,
                "actor_name": row.actor_name,
                "actor_role": row.actor_role,
            }
        )

    return success_response(data=data, message="Inventory movements listed")


@router.get("/critical/admin")
async def list_critical_stock_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    stmt = (
        select(
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            Item.id.label("item_id"),
            Item.name.label("item_name"),
            Item.sku.label("item_sku"),
            Item.unit.label("item_unit"),
            Item.low_stock_threshold.label("item_threshold"),
            WarehouseInventory.quantity.label("quantity"),
        )
        .join(WarehouseInventory, WarehouseInventory.warehouse_id == Warehouse.id)
        .join(Item, Item.id == WarehouseInventory.item_id)
        .where(Warehouse.status == "active", Item.is_active.is_(True))
        .order_by(WarehouseInventory.quantity.asc(), Warehouse.name.asc(), Item.name.asc())
    )
    rows = (await db.execute(stmt)).all()

    critical_rows = []
    for row in rows:
        threshold = row.item_threshold if row.item_threshold is not None else DEFAULT_LOW_STOCK_THRESHOLD
        if row.quantity <= threshold:
            critical_rows.append(
                {
                    "warehouse_id": row.warehouse_id,
                    "warehouse_name": row.warehouse_name,
                    "item_id": row.item_id,
                    "item_name": row.item_name,
                    "item_sku": row.item_sku,
                    "item_unit": row.item_unit,
                    "quantity": row.quantity,
                    "threshold": threshold,
                    "recommended_action": (
                        f"Review replenishment plan for {row.item_name} at {row.warehouse_name}."
                    ),
                }
            )

    return success_response(data=critical_rows, message="Critical stock listed")
