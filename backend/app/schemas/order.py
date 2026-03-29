from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.order import OrderStatus, OrderType
from app.schemas.location import LocationResponse
from app.schemas.product import ProductResponse


class OrderCreate(BaseModel):
    order_type: OrderType
    from_location_id: int
    to_location_id: int
    product_id: int
    quantity: int
    requested_date: date
    expected_delivery_date: Optional[date] = None
    note: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("発注数量は1以上でなければなりません")
        return v


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    actual_delivery_date: Optional[date] = None
    note: Optional[str] = None


class OrderPreviewResponse(BaseModel):
    is_valid: bool
    errors: list[str]
    order_type: OrderType
    from_location_id: int
    to_location_id: int
    product_id: int
    quantity: int
    requested_date: date
    expected_delivery_date: Optional[date]
    estimated_cost: Optional[float]
    route_lead_time_days: Optional[int]
    note: Optional[str]


class OrderResponse(BaseModel):
    id: int
    order_code: str
    order_type: OrderType
    from_location_id: int
    to_location_id: int
    product_id: int
    quantity: int
    unit_price: Optional[Decimal]
    status: OrderStatus
    requested_date: date
    expected_delivery_date: Optional[date]
    actual_delivery_date: Optional[date]
    note: Optional[str]
    created_by: int
    updated_by: Optional[int]
    from_location: LocationResponse
    to_location: LocationResponse
    product: ProductResponse
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
