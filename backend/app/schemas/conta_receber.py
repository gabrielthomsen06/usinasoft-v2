import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.cliente import ClienteResponse


class ContaReceberBase(BaseModel):
    descricao: str
    cliente_id: uuid.UUID
    ordem_producao_id: Optional[uuid.UUID] = None
    valor: float
    data_emissao: date
    data_vencimento: date
    observacoes: Optional[str] = None


class ContaReceberCreate(ContaReceberBase):
    pass


class ContaReceberUpdate(BaseModel):
    descricao: Optional[str] = None
    cliente_id: Optional[uuid.UUID] = None
    ordem_producao_id: Optional[uuid.UUID] = None
    valor: Optional[float] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[date] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None


class ContaReceberResponse(ContaReceberBase):
    id: uuid.UUID
    data_pagamento: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: datetime
    cliente: Optional[ClienteResponse] = None

    model_config = {"from_attributes": True}
