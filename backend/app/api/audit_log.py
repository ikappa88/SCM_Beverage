from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.services.auth import require_administrator

router = APIRouter(prefix="/api/audit-logs", tags=["監査ログ"])


@router.get("/", response_model=list[AuditLogResponse])
def list_audit_logs(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    username: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """監査ログ一覧（管理者のみ）"""
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if username:
        query = query.filter(AuditLog.username.contains(username))
    if action:
        query = query.filter(AuditLog.action == action)
    if resource:
        query = query.filter(AuditLog.resource.contains(resource))
    return query.offset(offset).limit(limit).all()
