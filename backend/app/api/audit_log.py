from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit_log import AuditLogResponse
from app.services.auth import get_current_user
from app.api.inventory import get_allowed_location_ids

router = APIRouter(prefix="/api/audit-logs", tags=["監査ログ"])

MASTER_RESOURCES = {"location", "product", "route"}


@router.get("/", response_model=list[AuditLogResponse])
def list_audit_logs(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    username: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sort_order: Literal["asc", "desc"] = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """監査ログ一覧
    - 管理者: 全ログ
    - 実務者: 担当拠点ログ ＋ マスタ変更ログ（location_id IS NULL かつ resource IN location/product/route）
    """
    if sort_order == "asc":
        query = db.query(AuditLog).order_by(AuditLog.created_at.asc())
    else:
        query = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    # 実務者は閲覧範囲を制限
    if current_user.role != UserRole.ADMINISTRATOR:
        allowed = get_allowed_location_ids(current_user)
        query = query.filter(
            or_(
                AuditLog.location_id.in_(allowed) if allowed else False,
                and_(
                    AuditLog.location_id.is_(None),
                    AuditLog.resource.in_(MASTER_RESOURCES),
                ),
            )
        )

    if username:
        query = query.filter(AuditLog.username.contains(username))
    if action:
        query = query.filter(AuditLog.action == action)
    if resource:
        query = query.filter(AuditLog.resource.contains(resource))
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at < date_to + timedelta(days=1))

    return query.offset(offset).limit(limit).all()
