from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.audit_log import AuditAction


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    username: str
    action: AuditAction
    resource: str
    resource_id: Optional[str]
    detail: Optional[str]
    ip_address: Optional[str]
    location_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
