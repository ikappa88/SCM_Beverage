from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.models.audit_log import AuditAction
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.audit import record
from app.services.auth import authenticate_user, get_current_user

router = APIRouter(prefix="/api/auth", tags=["認証"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, req: Request, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザー名またはパスワードが正しくありません",
        )
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    record(
        db,
        username=user.username,
        action=AuditAction.LOGIN,
        resource="auth",
        detail="ログイン成功",
        user_id=user.id,
        ip_address=req.client.host if req.client else None,
    )
    return TokenResponse(
        access_token=token,
        role=user.role.value,
        full_name=user.full_name,
        user_id=user.id,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user=Depends(get_current_user)):
    return current_user
