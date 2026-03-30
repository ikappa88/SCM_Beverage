from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit_log import AuditLogResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["監査ログ"])


def _build_query(
    db: Session,
    current_user: User,
    username: Optional[str],
    action: Optional[str],
    resource: Optional[str],
    resource_id: Optional[str],
    date_from: Optional[date],
    date_to: Optional[date],
    sort_order: Literal["asc", "desc"],
    force_own: bool = False,
):
    """共通クエリビルダー。force_own=True のとき username を current_user に固定する。"""
    if sort_order == "asc":
        query = db.query(AuditLog).order_by(AuditLog.created_at.asc())
    else:
        query = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    # 実務者: 自分の操作ログのみ参照可能
    if current_user.role != UserRole.ADMINISTRATOR or force_own:
        query = query.filter(AuditLog.username == current_user.username)
    elif username:
        query = query.filter(AuditLog.username.contains(username))

    if action:
        query = query.filter(AuditLog.action == action)
    if resource:
        query = query.filter(AuditLog.resource.contains(resource))
    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at < date_to + timedelta(days=1))

    return query


@router.get("/me", response_model=list[AuditLogResponse])
def get_my_audit_logs(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None),
    resource: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sort_order: Literal["asc", "desc"] = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """自分の操作履歴（実務者・管理者共通）"""
    query = _build_query(
        db, current_user, None, action, resource, resource_id, date_from, date_to, sort_order,
        force_own=True,
    )
    return query.offset(offset).limit(limit).all()


@router.get("/", response_model=list[AuditLogResponse])
def list_audit_logs(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    username: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sort_order: Literal["asc", "desc"] = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """監査ログ一覧
    - 管理者: 全ログ（usernameフィルタ有効）
    - 実務者: 自分の操作ログのみ（usernameフィルタは無視）
    """
    query = _build_query(
        db, current_user, username, action, resource, resource_id, date_from, date_to, sort_order,
    )
    return query.offset(offset).limit(limit).all()
