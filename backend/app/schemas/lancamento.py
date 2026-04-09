import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class LancamentoBase(BaseModel):
    tipo: str  # receita | despesa
    descricao: str
    valor: float
    data: date
    observacoes: Optional[str] = None


class LancamentoCreate(LancamentoBase):
    conta_receber_id: Optional[uuid.UUID] = None
    conta_pagar_id: Optional[uuid.UUID] = None


class LancamentoResponse(LancamentoBase):
    id: uuid.UUID
    conta_receber_id: Optional[uuid.UUID] = None
    conta_pagar_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResumoFinanceiro(BaseModel):
    total_receitas: float
    total_despesas: float
    saldo: float
