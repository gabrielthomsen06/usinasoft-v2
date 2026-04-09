import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class FornecedorBase(BaseModel):
    nome: str
    contato: Optional[str] = None
    email: Optional[EmailStr] = None
    cnpj_cpf: Optional[str] = None


class FornecedorCreate(FornecedorBase):
    pass


class FornecedorUpdate(BaseModel):
    nome: Optional[str] = None
    contato: Optional[str] = None
    email: Optional[EmailStr] = None
    cnpj_cpf: Optional[str] = None


class FornecedorResponse(FornecedorBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
