from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Inventory(Base, TimestampMixin):
    """在庫実績データ"""

    __tablename__ = "inventories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="現在庫数"
    )
    safety_stock: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="安全在庫数"
    )
    max_stock: Mapped[int] = mapped_column(
        Integer, nullable=False, default=9999, comment="最大在庫数"
    )
    expiry_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, comment="賞味期限"
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="備考")

    location = relationship("Location", foreign_keys=[location_id])
    product = relationship("Product", foreign_keys=[product_id])

    def __repr__(self) -> str:
        return f"<Inventory location={self.location_id} product={self.product_id} qty={self.quantity}>"
