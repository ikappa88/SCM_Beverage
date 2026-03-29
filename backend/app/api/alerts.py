from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.alert import Alert, AlertSeverity, AlertStatus, AlertType
from app.models.audit_log import AuditAction
from app.models.inventory import Inventory
from app.models.user import User, UserRole
from app.schemas.alert import AlertResponse, AlertStatusUpdate
from app.services.audit import record
from app.services.auth import get_current_user, require_administrator
from app.api.inventory import get_allowed_location_ids, check_location_access

router = APIRouter(prefix="/api/alerts", tags=["アラート管理"])


def _load_alert(db: Session, alert_id: int) -> Alert:
    alert = (
        db.query(Alert)
        .options(
            joinedload(Alert.location),
            joinedload(Alert.product),
        )
        .filter(Alert.id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="アラートが見つかりません")
    return alert


@router.get("/", response_model=list[AlertResponse])
def list_alerts(
    status: Optional[AlertStatus] = None,
    severity: Optional[AlertSeverity] = None,
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """アラート一覧取得"""
    query = db.query(Alert).options(
        joinedload(Alert.location),
        joinedload(Alert.product),
    )

    if status:
        query = query.filter(Alert.status == status)
    if severity:
        query = query.filter(Alert.severity == severity)
    if location_id:
        query = query.filter(Alert.location_id == location_id)

    alerts = query.order_by(Alert.created_at.desc()).all()

    # 実務者は担当拠点のアラートのみ
    allowed = get_allowed_location_ids(current_user)
    if allowed is not None:
        alerts = [a for a in alerts if a.location_id in allowed]

    return alerts


@router.patch("/{alert_id}/status", response_model=AlertResponse)
def update_alert_status(
    alert_id: int,
    payload: AlertStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """アラートの対応ステータスを更新する"""
    alert = _load_alert(db, alert_id)

    if not check_location_access(current_user, alert.location_id):
        raise HTTPException(
            status_code=403, detail="この拠点のアラートを更新する権限がありません"
        )

    alert.status = payload.status
    if payload.status == AlertStatus.RESOLVED:
        alert.resolved_by = current_user.id
        alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)

    record(
        db,
        username=current_user.username,
        action=AuditAction.UPDATE,
        resource="alert",
        resource_id=str(alert_id),
        detail=f"アラートステータス更新: {payload.status.value}",
        user_id=current_user.id,
        location_id=alert.location_id,
    )
    return alert


@router.post("/generate")
def generate_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(require_administrator),
    current_user: User = Depends(get_current_user),
):
    """在庫データからアラートを一括生成する（管理者のみ）"""
    inventories = (
        db.query(Inventory)
        .options(
            joinedload(Inventory.location),
            joinedload(Inventory.product),
        )
        .all()
    )

    created = 0
    for inv in inventories:
        if inv.quantity <= 0:
            alert_type = AlertType.STOCKOUT
            severity = AlertSeverity.DANGER
            title = f"在庫切れ: {inv.product.name}"
            message = (
                f"拠点「{inv.location.name}」の商品「{inv.product.name}」の在庫が0になりました。"
                f"至急補充が必要です。"
            )
        elif inv.quantity < inv.safety_stock:
            alert_type = AlertType.LOW_STOCK
            severity = AlertSeverity.WARNING
            title = f"安全在庫割れ: {inv.product.name}"
            message = (
                f"拠点「{inv.location.name}」の商品「{inv.product.name}」が安全在庫（{inv.safety_stock}）を"
                f"下回っています（現在: {inv.quantity}）。"
            )
        else:
            continue

        # 同条件のOPENアラートが既に存在する場合はスキップ
        existing = (
            db.query(Alert)
            .filter(
                Alert.location_id == inv.location_id,
                Alert.product_id == inv.product_id,
                Alert.alert_type == alert_type,
                Alert.status == AlertStatus.OPEN,
            )
            .first()
        )
        if existing:
            continue

        alert = Alert(
            alert_type=alert_type,
            severity=severity,
            location_id=inv.location_id,
            product_id=inv.product_id,
            title=title,
            message=message,
            status=AlertStatus.OPEN,
            auto_generated=True,
        )
        db.add(alert)
        created += 1

    db.commit()

    record(
        db,
        username=current_user.username,
        action=AuditAction.CREATE,
        resource="alert",
        detail=f"アラート自動生成: {created}件作成",
        user_id=current_user.id,
    )

    return {"message": f"{created}件のアラートを生成しました", "created": created}
