from typing import Optional
from sqlalchemy import Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class KpiThreshold(Base, TimestampMixin):
    """KPI閾値マスタ"""

    __tablename__ = "kpi_thresholds"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    kpi_key: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, comment="KPI識別キー"
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False, comment="表示名")
    warning_value: Mapped[float] = mapped_column(
        Float, nullable=False, comment="警告閾値"
    )
    danger_value: Mapped[float] = mapped_column(
        Float, nullable=False, comment="危険閾値"
    )
    unit: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="単位（%・日・件等）"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="説明"
    )

    def __repr__(self) -> str:
        return f"<KpiThreshold key={self.kpi_key} warn={self.warning_value} danger={self.danger_value}>"
