from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.audit_log import AuditAction
from app.models.delivery_record import DeliveryRecord, DeliveryStatus
from app.models.inventory import Inventory
from app.models.order import Order, OrderStatus, OrderType
from app.models.product import Product
from app.models.route import Route
from app.models.user import User, UserRole
from app.schemas.order import (
    OrderApprovalReject,
    OrderCreate,
    OrderPreviewResponse,
    OrderResponse,
    OrderStatusUpdate,
)
from app.services.alert_service import evaluate_inventory_alert
from app.services.audit import record
from app.services.auth import get_current_user
from app.api.inventory import check_location_access, get_allowed_location_ids

router = APIRouter(prefix="/api/orders", tags=["発注管理"])


def _generate_order_code(db: Session) -> str:
    """ORD-YYYYMMDD-NNN 形式で発注コードを採番する"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"ORD-{today}-"
    last = (
        db.query(Order.order_code)
        .filter(Order.order_code.like(f"{prefix}%"))
        .order_by(Order.order_code.desc())
        .first()
    )
    if last:
        seq = int(last[0][-3:]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:03d}"


def _load_order(db: Session, order_id: int) -> Order:
    order = (
        db.query(Order)
        .options(
            joinedload(Order.from_location),
            joinedload(Order.to_location),
            joinedload(Order.product),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="発注データが見つかりません")
    return order


def _validate_order(
    db: Session, payload: OrderCreate
) -> tuple[list[str], Optional[float], Optional[int], Optional[Route]]:
    """発注のバリデーション。(errors, estimated_cost, lead_time_days, route) を返す"""
    errors: list[str] = []
    estimated_cost: Optional[float] = None
    lead_time_days: Optional[int] = None

    product = db.query(Product).filter(Product.id == payload.product_id, Product.is_active == True).first()
    if not product:
        errors.append("指定した商品が見つかりません")
    elif payload.quantity % product.min_order_qty != 0:
        errors.append(
            f"発注数量は最小発注単位（{product.min_order_qty}）の倍数でなければなりません"
        )

    route = (
        db.query(Route)
        .filter(
            Route.origin_id == payload.from_location_id,
            Route.destination_id == payload.to_location_id,
            Route.is_active == True,
        )
        .first()
    )
    if not route:
        errors.append("指定した出発拠点と到着拠点間の有効なルートが見つかりません")
    else:
        lead_time_days = route.lead_time_days
        if route.cost_per_unit is not None:
            estimated_cost = float(route.cost_per_unit) * payload.quantity

    # TRANSFER（拠点間移管）の場合、出荷元の在庫が十分かチェックする
    if payload.order_type == OrderType.TRANSFER:
        from_inv = (
            db.query(Inventory)
            .filter(
                Inventory.location_id == payload.from_location_id,
                Inventory.product_id == payload.product_id,
            )
            .first()
        )
        current_qty = from_inv.quantity if from_inv else 0
        if current_qty < payload.quantity:
            errors.append(
                f"移管元拠点の在庫が不足しています（現在庫: {current_qty}、必要数: {payload.quantity}）"
            )

    return errors, estimated_cost, lead_time_days, route


@router.get("/", response_model=list[OrderResponse])
def list_orders(
    to_location_id: Optional[int] = None,
    status: Optional[OrderStatus] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """発注一覧取得"""
    query = db.query(Order).options(
        joinedload(Order.from_location),
        joinedload(Order.to_location),
        joinedload(Order.product),
    )

    if to_location_id:
        query = query.filter(Order.to_location_id == to_location_id)
    if status:
        query = query.filter(Order.status == status)
    if product_id:
        query = query.filter(Order.product_id == product_id)

    orders = query.order_by(Order.created_at.desc()).all()

    # 実務者は担当拠点向けの発注のみ
    allowed = get_allowed_location_ids(current_user)
    if allowed is not None:
        orders = [o for o in orders if o.to_location_id in allowed]

    return orders


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """発注詳細取得"""
    order = _load_order(db, order_id)
    if not check_location_access(current_user, order.to_location_id):
        raise HTTPException(status_code=403, detail="この発注を参照する権限がありません")
    return order


@router.post("/preview", response_model=OrderPreviewResponse)
def preview_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """発注プレビュー（DBに保存せず、バリデーション結果のみ返す）"""
    if not check_location_access(current_user, payload.to_location_id):
        raise HTTPException(
            status_code=403, detail="この拠点への発注権限がありません"
        )

    errors, estimated_cost, lead_time_days, _ = _validate_order(db, payload)

    # lead_time_days から hoped_delivery_date を計算
    expected_delivery_date = payload.expected_delivery_date
    if expected_delivery_date is None and lead_time_days is not None:
        from datetime import timedelta
        expected_delivery_date = payload.requested_date + timedelta(days=lead_time_days)

    return OrderPreviewResponse(
        is_valid=len(errors) == 0,
        errors=errors,
        order_type=payload.order_type,
        from_location_id=payload.from_location_id,
        to_location_id=payload.to_location_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        requested_date=payload.requested_date,
        expected_delivery_date=expected_delivery_date,
        estimated_cost=estimated_cost,
        route_lead_time_days=lead_time_days,
        note=payload.note,
    )


@router.post("/", response_model=OrderResponse)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """発注確定"""
    if not check_location_access(current_user, payload.to_location_id):
        raise HTTPException(
            status_code=403, detail="この拠点への発注権限がありません"
        )

    errors, estimated_cost, lead_time_days, route = _validate_order(db, payload)
    if errors:
        raise HTTPException(
            status_code=400, detail=f"バリデーションエラー: {'; '.join(errors)}"
        )

    expected_delivery_date = payload.expected_delivery_date
    if expected_delivery_date is None and lead_time_days is not None:
        from datetime import timedelta
        expected_delivery_date = payload.requested_date + timedelta(days=lead_time_days)

    unit_price = None
    if estimated_cost is not None and payload.quantity > 0:
        unit_price = estimated_cost / payload.quantity

    order_code = _generate_order_code(db)

    order = Order(
        order_code=order_code,
        order_type=payload.order_type,
        from_location_id=payload.from_location_id,
        to_location_id=payload.to_location_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        unit_price=unit_price,
        status=OrderStatus.AWAITING_APPROVAL,
        requested_date=payload.requested_date,
        expected_delivery_date=expected_delivery_date,
        note=payload.note,
        linked_alert_id=payload.linked_alert_id,
        created_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    record(
        db,
        username=current_user.username,
        action=AuditAction.CREATE,
        resource="order",
        resource_id=str(order.id),
        detail=f"発注作成（承認待ち）: {order_code} 商品ID={payload.product_id} 数量={payload.quantity}",
        user_id=current_user.id,
        location_id=payload.to_location_id,
    )
    return _load_order(db, order.id)


def _confirm_order_effects(db: Session, order: Order, current_user_id: int, username: str) -> None:
    """発注確定後の副作用: 配送記録生成・TRANSFER在庫減算・アラート再評価"""
    route = (
        db.query(Route)
        .filter(
            Route.origin_id == order.from_location_id,
            Route.destination_id == order.to_location_id,
            Route.is_active == True,
        )
        .first()
    )

    # 配送記録の自動生成
    dlv_code = None
    if route is not None:
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        dlv_prefix = f"DLV-{today_str}-"
        last_dlv = (
            db.query(DeliveryRecord.delivery_code)
            .filter(DeliveryRecord.delivery_code.like(f"{dlv_prefix}%"))
            .order_by(DeliveryRecord.delivery_code.desc())
            .first()
        )
        dlv_seq = (int(last_dlv[0][-3:]) + 1) if last_dlv else 1
        dlv_code = f"{dlv_prefix}{dlv_seq:03d}"
        db.add(DeliveryRecord(
            delivery_code=dlv_code,
            order_id=order.id,
            route_id=route.id,
            from_location_id=order.from_location_id,
            to_location_id=order.to_location_id,
            product_id=order.product_id,
            quantity=order.quantity,
            status=DeliveryStatus.SCHEDULED,
            scheduled_departure_date=order.requested_date,
            expected_arrival_date=order.expected_delivery_date or order.requested_date,
            created_by=current_user_id,
        ))

    # TRANSFER の場合、出荷元の在庫を即時減算
    from_inv_id = None
    if order.order_type == OrderType.TRANSFER:
        from_inv = (
            db.query(Inventory)
            .filter(
                Inventory.location_id == order.from_location_id,
                Inventory.product_id == order.product_id,
            )
            .first()
        )
        if from_inv:
            from_inv.quantity -= order.quantity
            evaluate_inventory_alert(db, from_inv)
            from_inv_id = from_inv.id

    db.commit()

    detail_parts = [f"発注確定: {order.order_code}"]
    if dlv_code:
        detail_parts.append(f"配送記録自動生成: {dlv_code}")
    record(
        db,
        username=username,
        action=AuditAction.UPDATE,
        resource="order",
        resource_id=str(order.id),
        detail=" / ".join(detail_parts),
        user_id=current_user_id,
        location_id=order.to_location_id,
    )
    if from_inv_id is not None:
        record(
            db,
            username=username,
            action=AuditAction.UPDATE,
            resource="inventory",
            resource_id=str(from_inv_id),
            detail=f"移管発注により在庫自動減算: -{order.quantity} (発注:{order.order_code})",
            user_id=current_user_id,
            location_id=order.from_location_id,
        )


@router.post("/{order_id}/approve", response_model=OrderResponse)
def approve_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """発注を承認する（管理者のみ）"""
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="管理者のみ発注を承認できます")

    order = _load_order(db, order_id)
    if order.status != OrderStatus.AWAITING_APPROVAL:
        raise HTTPException(
            status_code=400,
            detail=f"承認待ち（awaiting_approval）状態の発注のみ承認できます（現在: {order.status}）",
        )

    order.status = OrderStatus.CONFIRMED
    order.updated_by = current_user.id
    db.commit()

    _confirm_order_effects(db, order, current_user.id, current_user.username)

    return _load_order(db, order_id)


@router.post("/{order_id}/reject", response_model=OrderResponse)
def reject_order(
    order_id: int,
    payload: OrderApprovalReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """発注を却下する（管理者のみ）"""
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="管理者のみ発注を却下できます")

    order = _load_order(db, order_id)
    if order.status != OrderStatus.AWAITING_APPROVAL:
        raise HTTPException(
            status_code=400,
            detail=f"承認待ち（awaiting_approval）状態の発注のみ却下できます（現在: {order.status}）",
        )

    order.status = OrderStatus.CANCELLED
    order.rejection_reason = payload.rejection_reason
    order.updated_by = current_user.id
    db.commit()
    db.refresh(order)

    record(
        db,
        username=current_user.username,
        action=AuditAction.UPDATE,
        resource="order",
        resource_id=str(order_id),
        detail=f"発注却下: {order.order_code} 理由={payload.rejection_reason or '理由なし'}",
        user_id=current_user.id,
        location_id=order.to_location_id,
    )
    return _load_order(db, order_id)


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """発注ステータス更新"""
    order = _load_order(db, order_id)

    if not check_location_access(current_user, order.to_location_id):
        raise HTTPException(
            status_code=403, detail="この発注を更新する権限がありません"
        )

    # CONFIRMED以降のCANCELLEDは管理者のみ
    if (
        payload.status == OrderStatus.CANCELLED
        and order.status != OrderStatus.CONFIRMED
        and current_user.role != UserRole.ADMINISTRATOR
    ):
        raise HTTPException(
            status_code=403,
            detail="確定済み以降の発注キャンセルには管理者権限が必要です",
        )

    order.status = payload.status
    if payload.actual_delivery_date:
        order.actual_delivery_date = payload.actual_delivery_date
    if payload.note:
        order.note = payload.note
    order.updated_by = current_user.id

    db.commit()
    db.refresh(order)
    order = _load_order(db, order_id)

    record(
        db,
        username=current_user.username,
        action=AuditAction.UPDATE,
        resource="order",
        resource_id=str(order_id),
        detail=f"発注ステータス更新: {payload.status.value}",
        user_id=current_user.id,
        location_id=order.to_location_id,
    )
    return order


@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """発注削除（CONFIRMED状態のみ。管理者または担当実務者）"""
    order = _load_order(db, order_id)

    if not check_location_access(current_user, order.to_location_id):
        raise HTTPException(
            status_code=403, detail="この発注を削除する権限がありません"
        )

    if order.status != OrderStatus.CONFIRMED:
        raise HTTPException(
            status_code=400,
            detail="確定（CONFIRMED）状態の発注のみキャンセルできます",
        )

    order.status = OrderStatus.CANCELLED
    order.updated_by = current_user.id
    db.commit()

    record(
        db,
        username=current_user.username,
        action=AuditAction.DELETE,
        resource="order",
        resource_id=str(order_id),
        detail=f"発注キャンセル: {order.order_code}",
        user_id=current_user.id,
        location_id=order.to_location_id,
    )
    return {"message": "発注をキャンセルしました"}
