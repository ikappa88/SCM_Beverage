from datetime import date
from typing import Optional
from pydantic import BaseModel
from app.schemas.location import LocationResponse
from app.schemas.product import ProductResponse


class InventoryUpdate(BaseModel):
    quantity: Optional[int] = None
    safety_stock: Optional[int] = None
    max_stock: Optional[int] = None
    expiry_date: Optional[date] = None
    note: Optional[str] = None


class InventoryResponse(BaseModel):
    id: int
    location_id: int
    product_id: int
    quantity: int
    safety_stock: int
    max_stock: int
    expiry_date: Optional[date] = None
    note: Optional[str] = None
    location: LocationResponse
    product: ProductResponse
    is_readonly: bool = False  # 補充元拠点（閲覧専用）フラグ

    class Config:
        from_attributes = True


class InventoryAlertResponse(BaseModel):
    inventory_id: int
    location_name: str
    product_name: str
    quantity: int
    safety_stock: int
    alert_level: str


class SafetyStockUpdate(BaseModel):
    safety_stock: int
    max_stock: int


class InventoryATPResponse(BaseModel):
    """利用可能在庫（Available to Promise）"""
    location_id: int
    product_id: int
    location_name: str
    product_name: str
    current: int           # 現在庫数
    allocated: int         # 確定済み出荷引当数（他拠点への confirmed/in_transit 発注）
    atp: int               # 利用可能在庫 = current - allocated
    inbound: int           # 入荷予定数（scheduled/in_transit の配送）
    atp_with_inbound: int  # 入荷込みの利用可能在庫
