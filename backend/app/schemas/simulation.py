from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Clock
# ---------------------------------------------------------------------------

class ClockResponse(BaseModel):
    virtual_time: datetime
    half_day: str
    initial_time: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Advance
# ---------------------------------------------------------------------------

class AdvanceResponse(BaseModel):
    previous_virtual_time: datetime
    new_virtual_time: datetime
    half_day: str
    event_count: int
    events: list[dict[str, Any]]
    alerts_fired: int
    stockouts: list[str]


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

class SimulationEventResponse(BaseModel):
    id: int
    virtual_time: datetime
    half_day: str
    event_type: str
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

class SimulationParameterResponse(BaseModel):
    id: int
    category: str
    key: str
    value: Any
    description: Optional[str]
    updated_by: Optional[int]
    updated_at: datetime

    model_config = {"from_attributes": True}


class SimulationParameterUpdate(BaseModel):
    category: str
    key: str
    value: Any
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Movement Plan
# ---------------------------------------------------------------------------

class MovementPlanDayResponse(BaseModel):
    date: str
    inbound: int
    demand_estimate: int
    projected_stock: int
    is_stockout: bool


class MovementPlanResponse(BaseModel):
    tc_location_id: int
    product_id: int
    current_stock: int
    safety_stock: int
    atp: int
    stockout_date: Optional[str]
    days: list[MovementPlanDayResponse]
    wide_dc_quantity: int


# ---------------------------------------------------------------------------
# Wide DC Status
# ---------------------------------------------------------------------------

class WideDcStatusItem(BaseModel):
    dc_location_id: int
    product_id: int
    quantity: int
    safety_stock: int
    level: str  # "sufficient" | "warning" | "stockout"
