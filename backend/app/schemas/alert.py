from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.alert import AlertSeverity, AlertStatus, AlertType
from app.schemas.location import LocationResponse
from app.schemas.product import ProductResponse


class AlertStatusUpdate(BaseModel):
    status: AlertStatus


class AlertResponse(BaseModel):
    id: int
    alert_type: AlertType
    severity: AlertSeverity
    location_id: int
    product_id: Optional[int]
    title: str
    message: str
    status: AlertStatus
    resolved_by: Optional[int]
    resolved_at: Optional[datetime]
    auto_generated: bool
    location: LocationResponse
    product: Optional[ProductResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
