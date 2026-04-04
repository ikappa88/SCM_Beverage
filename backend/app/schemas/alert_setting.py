from datetime import datetime
from pydantic import BaseModel


class AlertSettingResponse(BaseModel):
    id: int
    setting_key: str
    label: str
    value: int
    description: str | None
    updated_at: datetime

    class Config:
        from_attributes = True


class AlertSettingUpdate(BaseModel):
    value: int
