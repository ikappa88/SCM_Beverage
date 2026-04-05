from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import Optional
import io
import pandas as pd

from app.core.database import get_db
from app.models.delivery_record import DeliveryRecord, DeliveryStatus
from app.models.inventory import Inventory
from app.models.order import Order, OrderStatus
from app.models.route import Route
from app.models.user import User, UserRole
from app.schemas.inventory import (
    InventoryAlertResponse,
    InventoryATPResponse,
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate,
    SafetyStockUpdate,
)
from app.services.auth import get_current_user, require_administrator

router = APIRouter(prefix="/api/inventory", tags=["在庫管理"])


def check_location_access(user: User, location_id: int) -> bool:
    """
    担当拠点アクセスチェック（inventory・upload共通）
    - 管理者: 全拠点アクセス可
    - 実務者: assigned_location_ids が未設定なら全拒否
    - 実務者: カンマ区切りの数値IDリストと照合
    """
    if user.role == UserRole.ADMINISTRATOR:
        return True
    if not user.assigned_location_ids or not user.assigned_location_ids.strip():
        return False
    allowed = [
        s.strip() for s in user.assigned_location_ids.split(",") if s.strip().isdigit()
    ]
    return str(location_id) in allowed


def get_allowed_location_ids(user: User) -> Optional[list[int]]:
    """
    実務者の許可拠点IDリストを返す
    - 管理者: None（全件）
    - 実務者: リスト（空リストなら0件）
    """
    if user.role == UserRole.ADMINISTRATOR:
        return None
    if not user.assigned_location_ids or not user.assigned_location_ids.strip():
        return []
    return [
        int(s.strip())
        for s in user.assigned_location_ids.split(",")
        if s.strip().isdigit()
    ]


@router.get("/safety-stocks", response_model=list[InventoryResponse])
def list_safety_stocks(
    db: Session = Depends(get_db),
    _: User = Depends(require_administrator),
):
    """全拠点×商品の安全在庫一覧（管理者のみ）"""
    return (
        db.query(Inventory)
        .options(joinedload(Inventory.location), joinedload(Inventory.product))
        .order_by(Inventory.location_id, Inventory.product_id)
        .all()
    )


def _get_upstream_location_ids(db: Session, own_location_ids: list[int]) -> list[int]:
    """ルートマスタからユーザー担当拠点への供給元拠点IDリストを返す（上流在庫可視化用）"""
    if not own_location_ids:
        return []
    rows = (
        db.query(Route.origin_id)
        .filter(
            Route.destination_id.in_(own_location_ids),
            Route.is_active == True,
        )
        .distinct()
        .all()
    )
    # 自拠点と重複する場合は除外
    own_set = set(own_location_ids)
    return [r.origin_id for r in rows if r.origin_id not in own_set]


@router.post("/", response_model=InventoryResponse, status_code=201)
def create_lot(
    payload: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新規ロット作成（拠点×商品×賞味期限の組み合わせで1ロット）"""
    if not check_location_access(current_user, payload.location_id):
        raise HTTPException(status_code=403, detail="この拠点の在庫を更新する権限がありません")

    # 同一ロット（location×product×manufacture_date）の重複チェック
    duplicate = (
        db.query(Inventory)
        .filter(
            Inventory.location_id == payload.location_id,
            Inventory.product_id == payload.product_id,
            Inventory.manufacture_date == payload.manufacture_date,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="同じ拠点・商品・製造日のロットが既に存在します",
        )

    # safety_stock / max_stock は同一拠点×商品の既存ロットからコピー
    existing = (
        db.query(Inventory)
        .filter(
            Inventory.location_id == payload.location_id,
            Inventory.product_id == payload.product_id,
        )
        .first()
    )
    safety_stock = existing.safety_stock if existing else 0
    max_stock = existing.max_stock if existing else 9999

    inv = Inventory(
        location_id=payload.location_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        manufacture_date=payload.manufacture_date,
        expiry_date=payload.expiry_date,
        note=payload.note,
        safety_stock=safety_stock,
        max_stock=max_stock,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    from app.models.audit_log import AuditAction
    from app.services.audit import record
    from app.services.alert_service import evaluate_inventory_alert

    record(
        db,
        username=current_user.username,
        action=AuditAction.CREATE,
        resource="inventory",
        resource_id=str(inv.id),
        detail=f"ロット追加: manufacture={payload.manufacture_date}, expiry={payload.expiry_date}, qty={payload.quantity}",
        user_id=current_user.id,
        location_id=inv.location_id,
    )
    evaluate_inventory_alert(db, inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.delete("/{inventory_id}", status_code=204)
def delete_lot(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """ロット削除（担当拠点の実務者・管理者）"""
    inv = db.query(Inventory).filter(Inventory.id == inventory_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="在庫データが見つかりません")
    if not check_location_access(current_user, inv.location_id):
        raise HTTPException(status_code=403, detail="この拠点の在庫を更新する権限がありません")

    from app.models.audit_log import AuditAction
    from app.services.audit import record

    record(
        db,
        username=current_user.username,
        action=AuditAction.DELETE,
        resource="inventory",
        resource_id=str(inventory_id),
        detail=f"ロット削除: manufacture={inv.manufacture_date}, expiry={inv.expiry_date}, qty={inv.quantity}",
        user_id=current_user.id,
        location_id=inv.location_id,
    )
    db.delete(inv)
    db.commit()


@router.get("/", response_model=list[InventoryResponse])
def list_inventory(
    location_id: Optional[int] = None,
    include_upstream: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """在庫一覧取得。include_upstream=true の場合、ルート上の補充元拠点の在庫も読み取り専用で返す"""
    query = db.query(Inventory).options(
        joinedload(Inventory.location),
        joinedload(Inventory.product),
    )
    if location_id:
        query = query.filter(Inventory.location_id == location_id)

    inventories = query.all()

    allowed = get_allowed_location_ids(current_user)
    if allowed is not None:
        own_ids = set(allowed)
        upstream_ids: set[int] = set()
        if include_upstream:
            upstream_ids = set(_get_upstream_location_ids(db, list(own_ids)))

        result = []
        for inv in inventories:
            if inv.location_id in own_ids:
                result.append(inv)
            elif inv.location_id in upstream_ids:
                # 上流拠点は is_readonly フラグを付けて返す（モデルには存在しないので辞書経由）
                inv.__dict__["is_readonly"] = True
                result.append(inv)
        return result

    return inventories


@router.get("/atp", response_model=InventoryATPResponse)
def get_atp(
    location_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    利用可能在庫（ATP: Available to Promise）を計算して返す。
    補充元拠点の現在庫から、他拠点への確定発注引当済み数を差し引き、
    入荷予定数を加算した「実際に発注可能な数量」を提示する。
    """
    inv = (
        db.query(Inventory)
        .options(joinedload(Inventory.location), joinedload(Inventory.product))
        .filter(
            Inventory.location_id == location_id,
            Inventory.product_id == product_id,
        )
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="在庫データが見つかりません")

    # 閲覧権限チェック（自拠点 or 上流拠点のみ）
    allowed = get_allowed_location_ids(current_user)
    if allowed is not None:
        own_ids = set(allowed)
        upstream_ids = set(_get_upstream_location_ids(db, list(own_ids)))
        if location_id not in own_ids and location_id not in upstream_ids:
            raise HTTPException(status_code=403, detail="この拠点の在庫を参照する権限がありません")

    # 確定済み出荷引当数（confirmed / in_transit で未着の発注）
    allocated = (
        db.query(func.coalesce(func.sum(Order.quantity), 0))
        .filter(
            Order.from_location_id == location_id,
            Order.product_id == product_id,
            Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT]),
        )
        .scalar()
    ) or 0

    # 入荷予定数（scheduled / in_transit の配送）
    inbound = (
        db.query(func.coalesce(func.sum(DeliveryRecord.quantity), 0))
        .filter(
            DeliveryRecord.to_location_id == location_id,
            DeliveryRecord.product_id == product_id,
            DeliveryRecord.status.in_([DeliveryStatus.SCHEDULED, DeliveryStatus.IN_TRANSIT]),
        )
        .scalar()
    ) or 0

    current = inv.quantity
    atp = current - int(allocated)

    return InventoryATPResponse(
        location_id=location_id,
        product_id=product_id,
        location_name=inv.location.name,
        product_name=inv.product.name,
        current=current,
        allocated=int(allocated),
        atp=atp,
        inbound=int(inbound),
        atp_with_inbound=atp + int(inbound),
    )


@router.get("/alerts", response_model=list[InventoryAlertResponse])
def get_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """在庫アラート一覧（安全在庫を下回っている在庫）"""
    inventories = (
        db.query(Inventory)
        .options(
            joinedload(Inventory.location),
            joinedload(Inventory.product),
        )
        .all()
    )

    allowed = get_allowed_location_ids(current_user)
    if allowed is not None:
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
    """在庫数量更新（担当拠点の実務者・管理者）"""
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
    if not check_location_access(current_user, inv.location_id):
        raise HTTPException(
            status_code=403, detail="この拠点の在庫を更新する権限がありません"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(inv, field, value)
    db.commit()
    db.refresh(inv)

    from app.models.audit_log import AuditAction
    from app.services.audit import record
    from app.services.alert_service import evaluate_inventory_alert

    record(
        db,
        username=current_user.username,
        action=AuditAction.UPDATE,
        resource="inventory",
        resource_id=str(inventory_id),
        detail=f"在庫修正: {payload.model_dump(exclude_unset=True)}",
        user_id=current_user.id,
        location_id=inv.location_id,
    )

    # 在庫更新後にアラートを自動評価
    evaluate_inventory_alert(db, inv)
    db.commit()

    return inv


@router.patch("/{inventory_id}/safety-stock", response_model=InventoryResponse)
def update_safety_stock(
    inventory_id: int,
    payload: SafetyStockUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_administrator),
):
    """安全在庫・最大在庫の個別更新（管理者のみ）"""
    inv = (
        db.query(Inventory)
        .options(joinedload(Inventory.location), joinedload(Inventory.product))
        .filter(Inventory.id == inventory_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="在庫データが見つかりません")

    inv.safety_stock = payload.safety_stock
    inv.max_stock = payload.max_stock
    db.commit()
    db.refresh(inv)

    from app.models.audit_log import AuditAction
    from app.services.audit import record
    from app.services.alert_service import evaluate_inventory_alert

    record(
        db,
        username=current_user.username,
        action=AuditAction.UPDATE,
        resource="inventory",
        resource_id=str(inventory_id),
        detail=f"安全在庫設定: safety_stock={payload.safety_stock}, max_stock={payload.max_stock}",
        user_id=current_user.id,
        location_id=inv.location_id,
    )

    # 安全在庫変更後にアラートを再評価（閾値が変わるためアラート状態が変化する可能性がある）
    evaluate_inventory_alert(db, inv)
    db.commit()

    return inv


@router.post("/safety-stocks/bulk")
async def bulk_update_safety_stocks(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_administrator),
):
    """CSVによる安全在庫一括更新（管理者のみ）
    CSVフォーマット: inventory_id, safety_stock, max_stock
    """
    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="CSVの読み込みに失敗しました")

    required = {"inventory_id", "safety_stock", "max_stock"}
    if not required.issubset(df.columns):
        raise HTTPException(status_code=400, detail=f"必須列が不足しています: {required}")

    updated = 0
    errors = []
    for _, row in df.iterrows():
        inv = db.query(Inventory).filter(Inventory.id == int(row["inventory_id"])).first()
        if not inv:
            errors.append(f"inventory_id={row['inventory_id']} が見つかりません")
            continue
        inv.safety_stock = int(row["safety_stock"])
        inv.max_stock = int(row["max_stock"])
        updated += 1

    if errors:
        db.rollback()
        raise HTTPException(status_code=400, detail={"errors": errors})

    db.commit()

    from app.models.audit_log import AuditAction
    from app.services.audit import record
    from app.services.alert_service import evaluate_inventory_alerts_bulk

    record(
        db,
        username=current_user.username,
        action=AuditAction.UPLOAD,
        resource="inventory",
        resource_id=None,
        detail=f"安全在庫CSV一括更新: {updated}件",
        user_id=current_user.id,
        location_id=None,
    )

    # 安全在庫変更後に一括アラート再評価
    updated_ids = [int(row["inventory_id"]) for _, row in df.iterrows()]
    evaluate_inventory_alerts_bulk(db, updated_ids)
    db.commit()

    return {"updated": updated}
