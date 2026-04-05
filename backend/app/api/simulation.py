from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.simulation import SimulationEvent, SimulationParameter
from app.models.user import User
from app.schemas.simulation import (
    AdvanceResponse,
    ClockResponse,
    SimulationEventResponse,
    SimulationParameterResponse,
    SimulationParameterUpdate,
)
from app.services.auth import get_current_user, require_administrator
from app.services.simulation_service import advance, get_clock, reset
from app.services.parameter_service import get_all_params, set_param

router = APIRouter(prefix="/api/simulation", tags=["シミュレーション"])


# ---------------------------------------------------------------------------
# Clock
# ---------------------------------------------------------------------------

@router.get("/clock", response_model=ClockResponse)
def get_virtual_clock(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClockResponse:
    clock = get_clock(db)
    return ClockResponse(
        virtual_time=clock.virtual_time,
        half_day=clock.half_day,
        initial_time=clock.initial_time,
        updated_at=clock.updated_at,
    )


@router.post("/advance", response_model=AdvanceResponse)
def advance_half_day(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdvanceResponse:
    """
    Advance virtual time by 12 hours and process all resulting events.
    Returns a summary of what happened.
    """
    try:
        result = advance(db, actor_user_id=current_user.id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return AdvanceResponse(
        previous_virtual_time=result.previous_virtual_time,
        new_virtual_time=result.new_virtual_time,
        half_day=result.half_day,
        event_count=result.event_count,
        events=result.events,
        alerts_fired=result.alerts_fired,
        stockouts=result.stockouts,
    )


@router.post("/reset", response_model=ClockResponse)
def reset_clock(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_administrator),
) -> ClockResponse:
    """Reset virtual time to initial_time. Admin only."""
    clock = reset(db)
    return ClockResponse(
        virtual_time=clock.virtual_time,
        half_day=clock.half_day,
        initial_time=clock.initial_time,
        updated_at=clock.updated_at,
    )


# ---------------------------------------------------------------------------
# Event log
# ---------------------------------------------------------------------------

@router.get("/events", response_model=list[SimulationEventResponse])
def list_events(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    event_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SimulationEventResponse]:
    query = db.query(SimulationEvent).order_by(SimulationEvent.id.desc())
    if event_type:
        query = query.filter(SimulationEvent.event_type == event_type)
    rows = query.offset(offset).limit(limit).all()
    return [SimulationEventResponse.model_validate(r) for r in rows]


# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

@router.get("/parameters", response_model=list[SimulationParameterResponse])
def list_parameters(
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_administrator),
) -> list[SimulationParameterResponse]:
    query = db.query(SimulationParameter)
    if category:
        query = query.filter(SimulationParameter.category == category)
    rows = query.order_by(SimulationParameter.category, SimulationParameter.key).all()
    return [SimulationParameterResponse.model_validate(r) for r in rows]


@router.patch("/parameters", response_model=SimulationParameterResponse)
def update_parameter(
    body: SimulationParameterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_administrator),
) -> SimulationParameterResponse:
    row = set_param(
        db=db,
        category=body.category,
        key=body.key,
        value=body.value,
        user_id=current_user.id,
    )
    if body.description is not None:
        row.description = body.description
        db.commit()
        db.refresh(row)
    return SimulationParameterResponse.model_validate(row)
