from typing import Optional
from pydantic import BaseModel


class KpiThresholdUpdate(BaseModel):
    warning_value: Optional[float] = None
    danger_value: Optional[float] = None
    description: Optional[str] = None


class KpiThresholdResponse(BaseModel):
    id: int
    kpi_key: str
    label: str
    warning_value: float
    danger_value: float
    unit: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True
