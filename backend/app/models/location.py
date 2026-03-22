import enum
from typing import Optional

from sqlalchemy import Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class LocationType(str, enum.Enum):
    FACTORY = "factory"  # 工場
    DC = "dc"  # 広域物流センター
    TC = "tc"  # 地域配送センター
    RETAIL = "retail"  # 小売


class Location(Base, TimestampMixin):
    """拠点マスタ"""

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="拠点コード"
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="拠点名")
    location_type: Mapped[LocationType] = mapped_column(
        Enum(LocationType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        comment="拠点種別",
    )
    area: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="担当エリア"
    )
    address: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="所在地"
    )
    capacity: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="保管キャパシティ"
    )
    is_active: Mapped[bool] = mapped_column(
        default=True, nullable=False, comment="有効フラグ"
    )

    def __repr__(self) -> str:
        return f"<Location code={self.code} name={self.name} type={self.location_type}>"
