from typing import Optional
from pydantic import BaseModel
from app.models.location import LocationType


class LocationBase(BaseModel):
    code: str
    name: str
    location_type: LocationType
    area: Optional[str] = None
    address: Optional[str] = None
    capacity: Optional[int] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    area: Optional[str] = None
    address: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class LocationResponse(LocationBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True
