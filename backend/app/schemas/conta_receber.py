import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.cliente import ClienteResponse

ContaReceberStatus = Literal["pendente", "pago", "vencido", "cancelado"]


class ContaReceberBase(BaseModel):
    descricao: str
    cliente_id: uuid.UUID
    ordem_producao_id: Optional[uuid.UUID] = None
    valor: float
    data_emissao: date
    data_vencimento: date
    observacoes: Optional[str] = None


class ContaReceberCreate(ContaReceberBase):
    total_parcelas: int = Field(1, ge=1)
    intervalo_dias: Optional[int] = Field(None, ge=0)


class ContaReceberUpdate(BaseModel):
    descricao: Optional[str] = None
    cliente_id: Optional[uuid.UUID] = None
    ordem_producao_id: Optional[uuid.UUID] = None
    valor: Optional[float] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[date] = None
    status: Optional[ContaReceberStatus] = None
    observacoes: Optional[str] = None
    intervalo_dias: Optional[int] = Field(None, ge=0)
    recalcular_parcelas_futuras: bool = False


class ContaReceberResponse(ContaReceberBase):
    id: uuid.UUID
    data_pagamento: Optional[date] = None
    status: ContaReceberStatus
    parcela_atual: int = 1
    total_parcelas: int = 1
    grupo_parcelas_id: Optional[uuid.UUID] = None
    intervalo_dias: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    cliente: Optional[ClienteResponse] = None

    model_config = {"from_attributes": True}
