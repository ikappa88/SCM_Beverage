from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.core.database import get_db
from app.models.inventory import Inventory
from app.models.user import User, UserRole
from app.schemas.inventory import (
    InventoryAlertResponse,
    InventoryResponse,
    InventoryUpdate,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/inventory", tags=["在庫管理"])


def _check_location_access(user: User, location_id: int) -> bool:
    if user.role == UserRole.ADMINISTRATOR:
        return True
    if not user.assigned_location_ids:
        return False
    allowed = [s.strip() for s in user.assigned_location_ids.split(",")]
    return str(location_id) in allowed


@router.get("/", response_model=list[InventoryResponse])
def list_inventory(
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Inventory).options(
        joinedload(Inventory.location),
        joinedload(Inventory.product),
    )
    if location_id:
        query = query.filter(Inventory.location_id == location_id)
    inventories = query.all()
    if current_user.role == UserRole.OPERATOR and current_user.assigned_location_ids:
        allowed = [
            int(s.strip())
            for s in current_user.assigned_location_ids.split(",")
            if s.strip().isdigit()
        ]
        inventories = [inv for inv in inventories if inv.location_id in allowed]
    return inventories


@router.get("/alerts", response_model=list[InventoryAlertResponse])
def get_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inventories = (
        db.query(Inventory)
        .options(
            joinedload(Inventory.location),
            joinedload(Inventory.product),
        )
        .all()
    )
    if current_user.role == UserRole.OPERATOR and current_user.assigned_location_ids:
        allowed = [
            int(s.strip())
            for s in current_user.assigned_location_ids.split(",")
            if s.strip().isdigit()
        ]
        inventories = [inv for inv in inventories if inv.location_id in allowed]
    alerts = []
    for inv in inventories:
        if inv.quantity <= 0:
            level = "danger"
        elif inv.quantity < inv.safety_stock:
            level = "warning"
        else:
            continue
        alerts.append(
            InventoryAlertResponse(
                inventory_id=inv.id,
                location_name=inv.location.name,
                product_name=inv.product.name,
                quantity=inv.quantity,
                safety_stock=inv.safety_stock,
                alert_level=level,
            )
        )
    return alerts


@router.patch("/{inventory_id}", response_model=InventoryResponse)
def update_inventory(
    inventory_id: int,
    payload: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = (
        db.query(Inventory)
        .options(
            joinedload(Inventory.location),
            joinedload(Inventory.product),
        )
        .filter(Inventory.id == inventory_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="在庫データが見つかりません")
    if not _check_location_access(current_user, inv.location_id):
        raise HTTPException(
            status_code=403, detail="この拠点の在庫を更新する権限がありません"
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(inv, field, value)
    db.commit()
    db.refresh(inv)
    from app.models.audit_log import AuditAction
    from app.services.audit import record

    record(
        db,
        username=current_user.username,
        action=AuditAction.UPDATE,
        resource="inventory",
        resource_id=str(inventory_id),
        detail=f"在庫修正: {payload.model_dump(exclude_unset=True)}",
        user_id=current_user.id,
    )
    return inv
