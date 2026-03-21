import enum
from typing import Optional

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    OPERATOR = "operator"
    ADMINISTRATOR = "administrator"


class User(Base, TimestampMixin):
    """ユーザーマスタ"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=UserRole.OPERATOR,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_location_ids: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )
    assigned_category_ids: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} role={self.role}>"
