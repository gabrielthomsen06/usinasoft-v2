import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.fornecedor import FornecedorResponse

ContaPagarStatus = Literal["pendente", "pago", "vencido", "cancelado"]
ContaPagarCategoria = Literal[
    "material", "servicos", "fixas", "impostos", "carro", "gasolina",
    "salario", "aluguel", "patrimonio", "outros",
]


class ContaPagarBase(BaseModel):
    descricao: str
    fornecedor_id: Optional[uuid.UUID] = None
    valor: float
    data_emissao: date
    data_vencimento: date
    categoria: ContaPagarCategoria = "outros"
    observacoes: Optional[str] = None


class ContaPagarCreate(ContaPagarBase):
    total_parcelas: int = Field(1, ge=1)
    intervalo_dias: Optional[int] = Field(None, ge=0)


class ContaPagarUpdate(BaseModel):
    descricao: Optional[str] = None
    fornecedor_id: Optional[uuid.UUID] = None
    valor: Optional[float] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[date] = None
    categoria: Optional[ContaPagarCategoria] = None
    status: Optional[ContaPagarStatus] = None
    observacoes: Optional[str] = None


class ContaPagarResponse(ContaPagarBase):
    id: uuid.UUID
    data_pagamento: Optional[date] = None
    status: ContaPagarStatus
    parcela_atual: int = 1
    total_parcelas: int = 1
    created_at: datetime
    updated_at: datetime
    fornecedor: Optional[FornecedorResponse] = None

    model_config = {"from_attributes": True}
