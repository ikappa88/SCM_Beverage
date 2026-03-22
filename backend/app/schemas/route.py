from typing import Optional
from pydantic import BaseModel
from app.schemas.location import LocationResponse


class RouteBase(BaseModel):
    code: str
    origin_id: int
    destination_id: int
    lead_time_days: int
    cost_per_unit: Optional[float] = None


class RouteCreate(RouteBase):
    pass


class RouteUpdate(BaseModel):
    lead_time_days: Optional[int] = None
    cost_per_unit: Optional[float] = None
    is_active: Optional[bool] = None


class RouteResponse(RouteBase):
    id: int
    is_active: bool
    origin: LocationResponse
    destination: LocationResponse

    class Config:
        from_attributes = True
