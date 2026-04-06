import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AlertType(str, enum.Enum):
    STOCKOUT = "stockout"
    LOW_STOCK = "low_stock"
    OVERSTOCK = "overstock"
    EXPIRY_EXPIRED = "expiry_expired"
    EXPIRY_NEAR = "expiry_near"
    DELAY = "delay"
    CUSTOM = "custom"


class AlertSeverity(str, enum.Enum):
    INFO = "info"       # 注意（過剰在庫など）
    WARNING = "warning" # 警告（安全在庫割れ・賞味期限間近）
    DANGER = "danger"   # 緊急（在庫切れ・賞味期限切れ）


class AlertStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class Alert(Base, TimestampMixin):
    """アラートログ"""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    alert_type: Mapped[AlertType] = mapped_column(
        Enum(AlertType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id"), nullable=False, index=True
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("products.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=AlertStatus.OPEN,
    )
    resolved_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    auto_generated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, comment="システム自動生成フラグ"
    )
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="スヌーズ解除日時"
    )
    snooze_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="スヌーズ理由"
    )

    location = relationship("Location", foreign_keys=[location_id])
    product = relationship("Product", foreign_keys=[product_id])
    resolver = relationship("User", foreign_keys=[resolved_by])
    linked_orders = relationship("Order", foreign_keys="Order.linked_alert_id", back_populates="linked_alert")
    comments = relationship("AlertComment", back_populates="alert")

    def __repr__(self) -> str:
        return f"<Alert type={self.alert_type} severity={self.severity} status={self.status}>"
