"""
在庫アラート自動評価サービス

在庫が更新されたタイミング、または定期バッチで呼び出し、
アラートを自動生成・自動解決する。
"""

from datetime import date, datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.alert import Alert, AlertSeverity, AlertStatus, AlertType
from app.models.alert_setting import AlertSetting, DEFAULT_EXPIRY_NEAR_DAYS, DEFAULT_EXPIRY_DANGER_DAYS
from app.models.inventory import Inventory


# ── 設定値取得 ────────────────────────────────────────────────────────────────

def _get_setting(db: Session, key: str, default: int) -> int:
    row = db.query(AlertSetting).filter(AlertSetting.setting_key == key).first()
    return row.value if row else default


# ── 公開API ──────────────────────────────────────────────────────────────────

def evaluate_inventory_alert(db: Session, inv: Inventory) -> None:
    """
    在庫1件のアラート状態を評価し、アラートを自動生成 or 自動解決する。

    呼び出し元でdb.commit()済みであること（inv は refresh 済みの値を持つ）。
    この関数内では commit しない（呼び出し元に委ねる）。
    """
    _evaluate_stockout(db, inv)
    _evaluate_low_stock(db, inv)
    _evaluate_overstock(db, inv)
    _evaluate_expiry(db, inv)


def evaluate_inventory_alerts_bulk(db: Session, inventory_ids: list[int]) -> int:
    """
    複数在庫IDをまとめて評価する（CSVアップロード後などに使用）。
    生成/解決したアラートの合計件数を返す。
    この関数内では commit しない。
    """
    count = 0
    for inv_id in inventory_ids:
        inv = db.query(Inventory).filter(Inventory.id == inv_id).first()
        if inv:
            evaluate_inventory_alert(db, inv)
            count += 1
    return count


def evaluate_all_inventories(db: Session) -> int:
    """
    全在庫を評価する（定期バッチから呼び出す）。
    commit は呼び出し元に委ねる。
    """
    inventories = db.query(Inventory).all()
    for inv in inventories:
        evaluate_inventory_alert(db, inv)
    return len(inventories)


# ── 内部ヘルパー ─────────────────────────────────────────────────────────────

def _is_snoozed(alert: Alert) -> bool:
    """アラートが現在スヌーズ中かどうかを返す"""
    if alert.snoozed_until is None:
        return False
    now = datetime.now(timezone.utc)
    return alert.snoozed_until > now


def _get_open_alert(
    db: Session, location_id: int, product_id: int, alert_type: AlertType
) -> Alert | None:
    return (
        db.query(Alert)
        .filter(
            Alert.location_id == location_id,
            Alert.product_id == product_id,
            Alert.alert_type == alert_type,
            Alert.status.in_([AlertStatus.OPEN, AlertStatus.IN_PROGRESS]),
        )
        .first()
    )


def _create_alert(
    db: Session,
    inv: Inventory,
    alert_type: AlertType,
    severity: AlertSeverity,
    title: str,
    message: str,
) -> None:
    """既存のオープンアラートがなければ新規作成する。スヌーズ中の場合は作成しない"""
    existing = _get_open_alert(db, inv.location_id, inv.product_id, alert_type)
    if existing:
        # スヌーズ期限が切れていたらスヌーズをリセットする
        if existing.snoozed_until and not _is_snoozed(existing):
            existing.snoozed_until = None
            existing.snooze_reason = None
        return
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


def _resolve_alert(db: Session, location_id: int, product_id: int, alert_type: AlertType) -> None:
    """条件が解消されたアラートを自動解決する"""
    alert = _get_open_alert(db, location_id, product_id, alert_type)
    if alert:
        alert.status = AlertStatus.RESOLVED
        alert.resolved_at = datetime.now(timezone.utc)


def _get_total_quantity(db: Session, location_id: int, product_id: int) -> int:
    """拠点×商品の全ロット合計在庫数を返す"""
    result = (
        db.query(func.coalesce(func.sum(Inventory.quantity), 0))
        .filter(
            Inventory.location_id == location_id,
            Inventory.product_id == product_id,
        )
        .scalar()
    )
    return int(result)


def _evaluate_stockout(db: Session, inv: Inventory) -> None:
    loc_name = inv.location.name if inv.location else f"ID:{inv.location_id}"
    prd_name = inv.product.name if inv.product else f"ID:{inv.product_id}"
    total = _get_total_quantity(db, inv.location_id, inv.product_id)

    if total <= 0:
        _create_alert(
            db, inv,
            alert_type=AlertType.STOCKOUT,
            severity=AlertSeverity.DANGER,
            title=f"在庫切れ: {prd_name}",
            message=(
                f"拠点「{loc_name}」の商品「{prd_name}」の在庫が0になりました。"
                f"至急補充が必要です。"
            ),
        )
    else:
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.STOCKOUT)


def _evaluate_low_stock(db: Session, inv: Inventory) -> None:
    if inv.safety_stock <= 0:
        return

    loc_name = inv.location.name if inv.location else f"ID:{inv.location_id}"
    prd_name = inv.product.name if inv.product else f"ID:{inv.product_id}"
    total = _get_total_quantity(db, inv.location_id, inv.product_id)

    if 0 < total < inv.safety_stock:
        _create_alert(
            db, inv,
            alert_type=AlertType.LOW_STOCK,
            severity=AlertSeverity.WARNING,
            title=f"安全在庫割れ: {prd_name}",
            message=(
                f"拠点「{loc_name}」の商品「{prd_name}」が"
                f"安全在庫（{inv.safety_stock}）を下回っています（合計在庫: {total}）。"
            ),
        )
    else:
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.LOW_STOCK)


def _evaluate_overstock(db: Session, inv: Inventory) -> None:
    if inv.max_stock <= 0:
        return

    loc_name = inv.location.name if inv.location else f"ID:{inv.location_id}"
    prd_name = inv.product.name if inv.product else f"ID:{inv.product_id}"
    total = _get_total_quantity(db, inv.location_id, inv.product_id)

    if total > inv.max_stock:
        _create_alert(
            db, inv,
            alert_type=AlertType.OVERSTOCK,
            severity=AlertSeverity.INFO,
            title=f"過剰在庫: {prd_name}",
            message=(
                f"拠点「{loc_name}」の商品「{prd_name}」が"
                f"最大在庫（{inv.max_stock}）を超えています（合計在庫: {total}）。"
            ),
        )
    else:
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.OVERSTOCK)


def _evaluate_expiry(db: Session, inv: Inventory) -> None:
    """賞味期限切れ・期限間近のアラートを評価する"""
    if not inv.expiry_date:
        # 賞味期限未設定なら既存アラートを解決して終了
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.EXPIRY_EXPIRED)
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.EXPIRY_NEAR)
        return

    loc_name = inv.location.name if inv.location else f"ID:{inv.location_id}"
    prd_name = inv.product.name if inv.product else f"ID:{inv.product_id}"
    today = date.today()
    days_left = (inv.expiry_date - today).days

    near_days = _get_setting(db, "expiry_near_days", DEFAULT_EXPIRY_NEAR_DAYS)
    danger_days = _get_setting(db, "expiry_danger_days", DEFAULT_EXPIRY_DANGER_DAYS)

    if days_left <= 0:
        # 賞味期限切れ（緊急）
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.EXPIRY_NEAR)
        _create_alert(
            db, inv,
            alert_type=AlertType.EXPIRY_EXPIRED,
            severity=AlertSeverity.DANGER,
            title=f"賞味期限切れ: {prd_name}",
            message=(
                f"拠点「{loc_name}」の商品「{prd_name}」の賞味期限が切れています"
                f"（期限: {inv.expiry_date.isoformat()}）。至急廃棄確認が必要です。"
            ),
        )
    elif days_left <= danger_days:
        # 期限まで danger_days 日以内（緊急扱い）
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.EXPIRY_NEAR)
        _create_alert(
            db, inv,
            alert_type=AlertType.EXPIRY_EXPIRED,
            severity=AlertSeverity.DANGER,
            title=f"賞味期限間近（緊急）: {prd_name}",
            message=(
                f"拠点「{loc_name}」の商品「{prd_name}」の賞味期限まで{days_left}日です"
                f"（期限: {inv.expiry_date.isoformat()}）。至急対応が必要です。"
            ),
        )
    elif days_left <= near_days:
        # 期限まで near_days 日以内（警告）
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.EXPIRY_EXPIRED)
        _create_alert(
            db, inv,
            alert_type=AlertType.EXPIRY_NEAR,
            severity=AlertSeverity.WARNING,
            title=f"賞味期限間近: {prd_name}",
            message=(
                f"拠点「{loc_name}」の商品「{prd_name}」の賞味期限まで{days_left}日です"
                f"（期限: {inv.expiry_date.isoformat()}）。"
            ),
        )
    else:
        # 問題なし → 既存アラートを解決
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.EXPIRY_EXPIRED)
        _resolve_alert(db, inv.location_id, inv.product_id, AlertType.EXPIRY_NEAR)
