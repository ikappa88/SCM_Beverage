from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserBase(BaseModel):
    username: str
    email: str
    full_name: str
    role: UserRole


class UserCreate(UserBase):
    password: str
    assigned_location_ids: str | None = None
    assigned_category_ids: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    assigned_location_ids: str | None = None
    assigned_category_ids: str | None = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    assigned_location_ids: str | None = None
    assigned_category_ids: str | None = None

    class Config:
        from_attributes = True
