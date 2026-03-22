import enum
from typing import Optional

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    UPLOAD = "upload"


class AuditLog(Base, TimestampMixin):
    """監査ログ"""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[AuditAction] = mapped_column(
        Enum(AuditAction, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    resource: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="操作対象リソース"
    )
    resource_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="変更内容の詳細"
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<AuditLog user={self.username} action={self.action} resource={self.resource}>"
