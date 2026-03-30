from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Scenario(Base, TimestampMixin):
    """需要変動シナリオマスタ"""

    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    demand_factor: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False, default=1.00)
    cost_factor: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False, default=1.00)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<Scenario code={self.code} demand={self.demand_factor} cost={self.cost_factor}>"
