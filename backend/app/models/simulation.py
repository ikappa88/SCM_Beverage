from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SimulationClock(Base):
    """仮想時刻（システム内に常に1レコードのみ存在 id=1）"""

    __tablename__ = "simulation_clock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    virtual_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, comment="現在の仮想時刻"
    )
    initial_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, comment="リセット先の初期時刻"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="最終更新日時（実時間）",
    )

    @property
    def half_day(self) -> str:
        """AM (00-11時) / PM (12-23時)"""
        return "AM" if self.virtual_time.hour < 12 else "PM"

    def __repr__(self) -> str:
        return f"<SimulationClock {self.virtual_time} ({self.half_day})>"


class SimulationEvent(Base):
    """時間進行ごとに発生したイベントのログ"""

    __tablename__ = "simulation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    virtual_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, index=True, comment="イベント発生時点の仮想時刻"
    )
    half_day: Mapped[str] = mapped_column(String(2), nullable=False, comment="AM or PM")
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True, comment="イベント種別"
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="イベント詳細"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        comment="実時間での記録日時",
    )

    def __repr__(self) -> str:
        return f"<SimulationEvent type={self.event_type} at={self.virtual_time}>"


class SimulationParameter(Base):
    """シミュレーション係数・パラメータの Key-Value ストア"""

    __tablename__ = "simulation_parameters"
    __table_args__ = (
        UniqueConstraint("category", "key", name="uq_sim_param_category_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True, comment="demand / delivery / stock / clock"
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False, comment="パラメータ名")
    value: Mapped[Any] = mapped_column(JSONB, nullable=False, comment="値")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="説明文")
    updated_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="最終更新ユーザー",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        comment="最終更新日時",
    )

    updater = relationship("User", foreign_keys=[updated_by])

    def __repr__(self) -> str:
        return f"<SimulationParameter {self.category}.{self.key}>"
