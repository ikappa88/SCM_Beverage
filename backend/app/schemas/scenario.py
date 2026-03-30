from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ScenarioCreate(BaseModel):
    code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    demand_factor: float = Field(1.00, ge=0.01, le=9.99)
    cost_factor: float = Field(1.00, ge=0.01, le=9.99)


class ScenarioUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    demand_factor: Optional[float] = Field(None, ge=0.01, le=9.99)
    cost_factor: Optional[float] = Field(None, ge=0.01, le=9.99)


class ScenarioResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    demand_factor: float
    cost_factor: float
    is_active: bool
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
