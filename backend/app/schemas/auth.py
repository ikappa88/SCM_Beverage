from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    user_id: int
    assigned_location_ids: str | None = None


class TokenData(BaseModel):
    user_id: int | None = None
    role: str | None = None
