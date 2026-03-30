from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.delivery_record import DeliveryStatus
from app.schemas.location import LocationResponse
from app.schemas.product import ProductResponse


class DeliveryRecordCreate(BaseModel):
    order_id: Optional[int] = None
    route_id: Optional[int] = None
    from_location_id: int
    to_location_id: int
    product_id: int
    quantity: int
    scheduled_departure_date: date
    expected_arrival_date: date
    note: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("配送数量は1以上でなければなりません")
        return v


class DeliveryStatusUpdate(BaseModel):
    status: DeliveryStatus
    actual_departure_date: Optional[date] = None
    actual_arrival_date: Optional[date] = None
    delay_reason: Optional[str] = None


class DeliveryRecordResponse(BaseModel):
    id: int
    delivery_code: str
    order_id: Optional[int]
    route_id: Optional[int]
    from_location_id: int
    to_location_id: int
    product_id: int
    quantity: int
    status: DeliveryStatus
    scheduled_departure_date: date
    actual_departure_date: Optional[date]
    expected_arrival_date: date
    actual_arrival_date: Optional[date]
    delay_reason: Optional[str]
    note: Optional[str]
    created_by: int
    from_location: LocationResponse
    to_location: LocationResponse
    product: ProductResponse
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
