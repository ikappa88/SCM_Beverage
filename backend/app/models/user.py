import enum
from typing import Optional

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    OPERATOR = "operator"  # 実務者
    ADMINISTRATOR = "administrator"  # 管理者


class User(Base, TimestampMixin):
    """ユーザーマスタ"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), nullable=False, default=UserRole.OPERATOR
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 実務者の担当範囲（管理者はNULL = 全拠点・全商品）
    assigned_location_ids: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="担当拠点IDをカンマ区切りで保持"
    )
    assigned_category_ids: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="担当商品カテゴリIDをカンマ区切りで保持"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} role={self.role}>"
