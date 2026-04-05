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
