import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.fornecedor import FornecedorResponse


class ContaPagarBase(BaseModel):
    descricao: str
    fornecedor_id: Optional[uuid.UUID] = None
    valor: float
    data_emissao: date
    data_vencimento: date
    categoria: str = "outros"
    observacoes: Optional[str] = None


class ContaPagarCreate(ContaPagarBase):
    total_parcelas: int = 1


class ContaPagarUpdate(BaseModel):
    descricao: Optional[str] = None
    fornecedor_id: Optional[uuid.UUID] = None
    valor: Optional[float] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[date] = None
    categoria: Optional[str] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None


class ContaPagarResponse(ContaPagarBase):
    id: uuid.UUID
    data_pagamento: Optional[date] = None
    status: str
    parcela_atual: int = 1
    total_parcelas: int = 1
    created_at: datetime
    updated_at: datetime
    fornecedor: Optional[FornecedorResponse] = None

    model_config = {"from_attributes": True}
