from typing import Optional
from pydantic import BaseModel


class ProductBase(BaseModel):
    code: str
    name: str
    category: str
    unit_size: Optional[str] = None
    min_order_qty: int = 1
    weight_kg: Optional[float] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit_size: Optional[str] = None
    min_order_qty: Optional[int] = None
    weight_kg: Optional[float] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True
