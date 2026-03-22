from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.kpi_threshold import KpiThreshold
from app.schemas.kpi_threshold import KpiThresholdResponse, KpiThresholdUpdate
from app.services.auth import get_current_user, require_administrator

router = APIRouter(prefix="/api/kpi-thresholds", tags=["KPI閾値設定"])


@router.get("/", response_model=list[KpiThresholdResponse])
def list_thresholds(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """KPI閾値一覧（全ロール参照可）"""
    return db.query(KpiThreshold).all()


@router.patch("/{kpi_key}", response_model=KpiThresholdResponse)
def update_threshold(
    kpi_key: str,
    payload: KpiThresholdUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """KPI閾値更新（管理者のみ）"""
    threshold = db.query(KpiThreshold).filter(KpiThreshold.kpi_key == kpi_key).first()
    if not threshold:
        raise HTTPException(status_code=404, detail="KPI閾値が見つかりません")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(threshold, field, value)
    db.commit()
    db.refresh(threshold)
    return threshold
