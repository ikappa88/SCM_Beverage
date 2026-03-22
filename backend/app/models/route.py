from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Route(Base, TimestampMixin):
    """輸送ルートマスタ"""

    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="ルートコード"
    )
    origin_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id"), nullable=False, comment="出発拠点ID"
    )
    destination_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id"), nullable=False, comment="到着拠点ID"
    )
    lead_time_days: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="標準リードタイム（日）"
    )
    cost_per_unit: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="輸送コスト原単位"
    )
    is_active: Mapped[bool] = mapped_column(
        default=True, nullable=False, comment="有効フラグ"
    )

    origin = relationship("Location", foreign_keys=[origin_id])
    destination = relationship("Location", foreign_keys=[destination_id])

    def __repr__(self) -> str:
        return f"<Route code={self.code} origin={self.origin_id} dest={self.destination_id}>"
