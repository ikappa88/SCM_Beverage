from typing import Optional
from pydantic import BaseModel
from app.schemas.location import LocationResponse
from app.schemas.product import ProductResponse


class InventoryUpdate(BaseModel):
    quantity: Optional[int] = None
    safety_stock: Optional[int] = None
    max_stock: Optional[int] = None
    note: Optional[str] = None


class InventoryResponse(BaseModel):
    id: int
    location_id: int
    product_id: int
    quantity: int
    safety_stock: int
    max_stock: int
    note: Optional[str] = None
    location: LocationResponse
    product: ProductResponse

    class Config:
        from_attributes = True


class InventoryAlertResponse(BaseModel):
    inventory_id: int
    location_name: str
    product_name: str
    quantity: int
    safety_stock: int
    alert_level: str
