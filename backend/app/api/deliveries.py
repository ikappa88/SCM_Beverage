from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.audit_log import AuditAction
from app.models.delivery_record import DeliveryRecord, DeliveryStatus
from app.models.inventory import Inventory
from app.models.user import User
from app.schemas.delivery_record import (
    DeliveryRecordCreate,
    DeliveryRecordResponse,
    DeliveryStatusUpdate,
)
from app.services.audit import record
from app.services.auth import get_current_user
from app.api.inventory import check_location_access, get_allowed_location_ids

router = APIRouter(prefix="/api/deliveries", tags=["配送管理"])


def _generate_delivery_code(db: Session) -> str:
    """DLV-YYYYMMDD-NNN 形式で配送コードを採番する"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"DLV-{today}-"
    last = (
        db.query(DeliveryRecord.delivery_code)
        .filter(DeliveryRecord.delivery_code.like(f"{prefix}%"))
        .order_by(DeliveryRecord.delivery_code.desc())
        .first()
    )
    if last:
        seq = int(last[0][-3:]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:03d}"


def _load_delivery(db: Session, delivery_id: int) -> DeliveryRecord:
    delivery = (
        db.query(DeliveryRecord)
        .options(
            joinedload(DeliveryRecord.from_location),
            joinedload(DeliveryRecord.to_location),
            joinedload(DeliveryRecord.product),
        )
        .filter(DeliveryRecord.id == delivery_id)
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="配送記録が見つかりません")
    return delivery


@router.get("/", response_model=list[DeliveryRecordResponse])
def list_deliveries(
    location_id: Optional[int] = None,
    status: Optional[DeliveryStatus] = None,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """配送記録一覧取得"""
    query = db.query(DeliveryRecord).options(
        joinedload(DeliveryRecord.from_location),
        joinedload(DeliveryRecord.to_location),
        joinedload(DeliveryRecord.product),
    )

    if location_id:
        query = query.filter(
            or_(
                DeliveryRecord.from_location_id == location_id,
                DeliveryRecord.to_location_id == location_id,
            )
        )
    if status:
        query = query.filter(DeliveryRecord.status == status)
    if date_from:
        query = query.filter(DeliveryRecord.expected_arrival_date >= date_from)
    if date_to:
        query = query.filter(DeliveryRecord.expected_arrival_date <= date_to)

    deliveries = query.order_by(DeliveryRecord.expected_arrival_date.asc()).all()

    # 実務者は担当拠点に関連する配送のみ
    allowed = get_allowed_location_ids(current_user)
    if allowed is not None:
        deliveries = [
            d for d in deliveries
            if d.from_location_id in allowed or d.to_location_id in allowed
        ]

    return deliveries


@router.get("/{delivery_id}", response_model=DeliveryRecordResponse)
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """配送記録詳細取得"""
    delivery = _load_delivery(db, delivery_id)
    allowed = get_allowed_location_ids(current_user)
    if allowed is not None:
        if delivery.from_location_id not in allowed and delivery.to_location_id not in allowed:
            raise HTTPException(status_code=403, detail="この配送記録を参照する権限がありません")
    return delivery


@router.post("/", response_model=DeliveryRecordResponse)
def create_delivery(
    payload: DeliveryRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """配送記録作成"""
    if not check_location_access(current_user, payload.from_location_id):
        raise HTTPException(
            status_code=403, detail="この出発拠点の配送記録を作成する権限がありません"
        )

    delivery_code = _generate_delivery_code(db)

    delivery = DeliveryRecord(
        delivery_code=delivery_code,
        order_id=payload.order_id,
        route_id=payload.route_id,
        from_location_id=payload.from_location_id,
        to_location_id=payload.to_location_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        status=DeliveryStatus.SCHEDULED,
        scheduled_departure_date=payload.scheduled_departure_date,
        expected_arrival_date=payload.expected_arrival_date,
        note=payload.note,
        created_by=current_user.id,
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)

    delivery = _load_delivery(db, delivery.id)

    record(
        db,
        username=current_user.username,
        action=AuditAction.CREATE,
        resource="delivery",
        resource_id=str(delivery.id),
        detail=f"配送記録作成: {delivery_code}",
        user_id=current_user.id,
        location_id=payload.from_location_id,
    )
    return delivery


@router.patch("/{delivery_id}/status", response_model=DeliveryRecordResponse)
def update_delivery_status(
    delivery_id: int,
    payload: DeliveryStatusUpdate,
    update_inventory: bool = Query(False, description="ARRIVED時に在庫を自動加算するか"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """配送ステータス更新"""
    delivery = _load_delivery(db, delivery_id)

    allowed = get_allowed_location_ids(current_user)
    if allowed is not None:
        if delivery.from_location_id not in allowed and delivery.to_location_id not in allowed:
            raise HTTPException(
                status_code=403, detail="この配送記録を更新する権限がありません"
            )

    delivery.status = payload.status
    if payload.actual_departure_date:
        delivery.actual_departure_date = payload.actual_departure_date
    if payload.actual_arrival_date:
        delivery.actual_arrival_date = payload.actual_arrival_date
    if payload.delay_reason:
        delivery.delay_reason = payload.delay_reason

    inventory_result = None
    # ARRIVED かつ update_inventory=True の場合、到着先拠点の在庫を加算
    if payload.status == DeliveryStatus.ARRIVED and update_inventory:
        inv = (
            db.query(Inventory)
            .filter(
                Inventory.location_id == delivery.to_location_id,
                Inventory.product_id == delivery.product_id,
            )
            .first()
        )
        if inv:
            inv.quantity += delivery.quantity
            inventory_result = {"updated": True, "new_quantity": inv.quantity}
        else:
            inventory_result = {
                "updated": False,
                "reason": "inventory record not found",
            }

    db.commit()
    db.refresh(delivery)
    delivery = _load_delivery(db, delivery_id)

    detail_msg = f"配送ステータス更新: {payload.status.value}"
    if inventory_result:
        detail_msg += f" / 在庫反映: {inventory_result}"

    record(
        db,
        username=current_user.username,
        action=AuditAction.UPDATE,
        resource="delivery",
        resource_id=str(delivery_id),
        detail=detail_msg,
        user_id=current_user.id,
        location_id=delivery.from_location_id,
    )
    return delivery
