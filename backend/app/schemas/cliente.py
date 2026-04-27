import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class ClienteBase(BaseModel):
    nome: str
    contato: Optional[str] = None
    email: Optional[EmailStr] = None
    cnpj_cpf: Optional[str] = None
    endereco: Optional[str] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nome: Optional[str] = None
    contato: Optional[str] = None
    email: Optional[EmailStr] = None
    cnpj_cpf: Optional[str] = None
    endereco: Optional[str] = None


class ClienteResponse(ClienteBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
