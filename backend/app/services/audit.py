from typing import Optional
from sqlalchemy.orm import Session

from app.models.audit_log import AuditAction, AuditLog


def record(
    db: Session,
    username: str,
    action: AuditAction,
    resource: str,
    resource_id: Optional[str] = None,
    detail: Optional[str] = None,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """監査ログを記録する"""
    log = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        resource=resource,
        resource_id=resource_id,
        detail=detail,
        ip_address=ip_address,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
