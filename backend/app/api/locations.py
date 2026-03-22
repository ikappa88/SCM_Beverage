from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationResponse, LocationUpdate
from app.services.auth import get_current_user, require_administrator

router = APIRouter(prefix="/api/locations", tags=["拠点マスタ"])


@router.get("/", response_model=list[LocationResponse])
def list_locations(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """拠点一覧（全ロール参照可）"""
    return db.query(Location).all()


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """拠点詳細（全ロール参照可）"""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="拠点が見つかりません")
    return location


@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """拠点新規作成（管理者のみ）"""
    if db.query(Location).filter(Location.code == payload.code).first():
        raise HTTPException(
            status_code=400, detail="この拠点コードはすでに使用されています"
        )
    location = Location(**payload.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.patch("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """拠点更新（管理者のみ）"""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="拠点が見つかりません")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(location, field, value)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_location(
    location_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """拠点無効化・論理削除（管理者のみ）"""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="拠点が見つかりません")
    location.is_active = False
    db.commit()
