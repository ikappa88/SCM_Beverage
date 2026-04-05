from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WideDcInventory(Base):
    """広域DC在庫（TC在庫とは独立して管理）"""

    __tablename__ = "wide_dc_inventory"
    __table_args__ = (
        UniqueConstraint("location_id", "product_id", name="uq_wide_dc_inv_loc_prod"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    location_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="広域DC拠点ID",
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="商品ID",
    )
    quantity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="現在庫数"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        comment="最終更新日時",
    )

    location = relationship("Location", foreign_keys=[location_id])
    product = relationship("Product", foreign_keys=[product_id])

    def __repr__(self) -> str:
        return f"<WideDcInventory loc={self.location_id} prod={self.product_id} qty={self.quantity}>"
