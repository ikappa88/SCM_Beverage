import enum
from datetime import date
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class DeliveryStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    DEPARTED = "departed"
    IN_TRANSIT = "in_transit"
    ARRIVED = "arrived"
    DELAYED = "delayed"
    CANCELLED = "cancelled"


class DeliveryRecord(Base, TimestampMixin):
    """配送実績データ"""

    __tablename__ = "delivery_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    delivery_code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="配送コード（DLV-YYYYMMDD-NNN）"
    )
    order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("orders.id"), nullable=True, comment="関連発注ID"
    )
    route_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("routes.id"), nullable=True, comment="輸送ルートID"
    )
    from_location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id"), nullable=False, index=True, comment="出発拠点ID"
    )
    to_location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id"), nullable=False, index=True, comment="到着拠点ID"
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, comment="配送数量")
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=DeliveryStatus.SCHEDULED,
        index=True,
    )
    scheduled_departure_date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="予定出発日"
    )
    actual_departure_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="実出発日"
    )
    expected_arrival_date: Mapped[date] = mapped_column(
        Date, nullable=False, index=True, comment="到着予定日"
    )
    actual_arrival_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="実到着日"
    )
    delay_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="遅延理由"
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, comment="作成者ID"
    )

    from_location = relationship("Location", foreign_keys=[from_location_id])
    to_location = relationship("Location", foreign_keys=[to_location_id])
    product = relationship("Product", foreign_keys=[product_id])
    order = relationship("Order", foreign_keys=[order_id])
    route = relationship("Route", foreign_keys=[route_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<DeliveryRecord code={self.delivery_code} status={self.status}>"
