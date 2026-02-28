import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UsuarioBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str


class UsuarioCreate(UsuarioBase):
    password: str


class UsuarioUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UsuarioResponse(UsuarioBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UsuarioInDB(UsuarioResponse):
    password_hash: str
