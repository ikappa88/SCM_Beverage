from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.auth import require_administrator

router = APIRouter(prefix="/api/users", tags=["ユーザー管理"])


@router.get("/", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """ユーザー一覧取得（管理者のみ）"""
    return db.query(User).all()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """ユーザー新規作成（管理者のみ）"""
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このユーザー名はすでに使用されています",
        )
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスはすでに使用されています",
        )
    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        hashed_password=get_password_hash(payload.password),
        assigned_location_ids=payload.assigned_location_ids,
        assigned_category_ids=payload.assigned_category_ids,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """ユーザー情報更新（管理者のみ）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """ユーザー無効化（論理削除・管理者のみ）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ユーザーが見つかりません",
        )
    user.is_active = False
    db.commit()
