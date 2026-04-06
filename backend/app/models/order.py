import enum
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class OrderType(str, enum.Enum):
    REPLENISHMENT = "replenishment"
    TRANSFER = "transfer"
    EMERGENCY = "emergency"


class OrderStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Order(Base, TimestampMixin):
    """発注データ"""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="発注コード（ORD-YYYYMMDD-NNN）"
    )
    order_type: Mapped[OrderType] = mapped_column(
        Enum(OrderType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    from_location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id"), nullable=False, comment="補充元拠点ID"
    )
    to_location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id"), nullable=False, index=True, comment="補充先拠点ID"
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, comment="発注数量")
    unit_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, comment="単価"
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=OrderStatus.CONFIRMED,
        index=True,
    )
    requested_date: Mapped[date] = mapped_column(Date, nullable=False, comment="発注日")
    expected_delivery_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="希望納期"
    )
    actual_delivery_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="実納期"
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linked_alert_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True, comment="対応元アラートID"
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, comment="作成者ID"
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True, comment="最終更新者ID"
    )

    from_location = relationship("Location", foreign_keys=[from_location_id])
    to_location = relationship("Location", foreign_keys=[to_location_id])
    product = relationship("Product", foreign_keys=[product_id])
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    linked_alert = relationship("Alert", foreign_keys=[linked_alert_id], back_populates="linked_orders")

    def __repr__(self) -> str:
        return f"<Order code={self.order_code} status={self.status}>"
