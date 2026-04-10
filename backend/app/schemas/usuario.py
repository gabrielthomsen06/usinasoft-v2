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
    role: str = "user"


class UsuarioUpdate(BaseModel):
    """Usado por admins — permite alterar role e is_active."""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None


class UsuarioSelfUpdate(BaseModel):
    """Usado pelo próprio usuário — NÃO permite alterar role ou is_active."""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None


class UsuarioResponse(UsuarioBase):
    id: uuid.UUID
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UsuarioInDB(UsuarioResponse):
    password_hash: str
