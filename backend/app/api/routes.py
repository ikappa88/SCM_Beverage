from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.route import Route
from app.schemas.route import RouteCreate, RouteResponse, RouteUpdate
from app.services.auth import get_current_user, require_administrator

router = APIRouter(prefix="/api/routes", tags=["ルートマスタ"])


@router.get("/", response_model=list[RouteResponse])
def list_routes(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """ルート一覧（全ロール参照可）"""
    return (
        db.query(Route)
        .options(joinedload(Route.origin), joinedload(Route.destination))
        .all()
    )


@router.post("/", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
def create_route(
    payload: RouteCreate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """ルート新規作成（管理者のみ）"""
    if db.query(Route).filter(Route.code == payload.code).first():
        raise HTTPException(
            status_code=400, detail="このルートコードはすでに使用されています"
        )
    route = Route(**payload.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    return (
        db.query(Route)
        .options(joinedload(Route.origin), joinedload(Route.destination))
        .filter(Route.id == route.id)
        .first()
    )


@router.patch("/{route_id}", response_model=RouteResponse)
def update_route(
    route_id: int,
    payload: RouteUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """ルート更新（管理者のみ）"""
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="ルートが見つかりません")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(route, field, value)
    db.commit()
    db.refresh(route)
    return (
        db.query(Route)
        .options(joinedload(Route.origin), joinedload(Route.destination))
        .filter(Route.id == route.id)
        .first()
    )


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_route(
    route_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """ルート無効化・論理削除（管理者のみ）"""
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="ルートが見つかりません")
    route.is_active = False
    db.commit()
