from typing import Optional

from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    """商品マスタ"""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="商品コード"
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="商品名")
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="カテゴリ"
    )
    unit_size: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="容量（例：500ml）"
    )
    min_order_qty: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False, comment="最小発注単位（ケース）"
    )
    weight_kg: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="重量(kg)"
    )
    is_active: Mapped[bool] = mapped_column(
        default=True, nullable=False, comment="有効フラグ"
    )

    def __repr__(self) -> str:
        return f"<Product code={self.code} name={self.name}>"
