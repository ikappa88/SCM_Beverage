from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# デフォルト値定数
DEFAULT_EXPIRY_NEAR_DAYS = 7   # 賞味期限の何日前から警告を出すか
DEFAULT_EXPIRY_DANGER_DAYS = 3  # 賞味期限の何日前から緊急にするか


class AlertSetting(Base, TimestampMixin):
    """アラートしきい値設定"""

    __tablename__ = "alert_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    setting_key: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<AlertSetting {self.setting_key}={self.value}>"
