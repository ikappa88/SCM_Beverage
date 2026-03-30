from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.scenario import Scenario
from app.models.user import User
from app.schemas.scenario import ScenarioCreate, ScenarioResponse, ScenarioUpdate
from app.services.auth import get_current_user, require_administrator

router = APIRouter(prefix="/api/scenarios", tags=["シナリオ管理"])


@router.get("/", response_model=list[ScenarioResponse])
def list_scenarios(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """シナリオ一覧（全ロール参照可）"""
    return db.query(Scenario).order_by(Scenario.code).all()


@router.post("/", response_model=ScenarioResponse, status_code=201)
def create_scenario(
    payload: ScenarioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_administrator),
):
    """シナリオ作成（管理者のみ）"""
    if db.query(Scenario).filter(Scenario.code == payload.code).first():
        raise HTTPException(status_code=409, detail="このコードは既に使用されています")

    scenario = Scenario(**payload.model_dump(), created_by=current_user.id)
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.patch("/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(
    scenario_id: int,
    payload: ScenarioUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_administrator),
):
    """シナリオ更新（管理者のみ）"""
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="シナリオが見つかりません")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(scenario, field, value)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}", status_code=204)
def deactivate_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_administrator),
):
    """シナリオ無効化（論理削除、管理者のみ）"""
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="シナリオが見つかりません")

    scenario.is_active = False
    db.commit()
