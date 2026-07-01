from pydantic import BaseModel, EmailStr

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    plan: str
    is_admin: bool
    status: str
    uploads_used: int
    uploads_limit: int
