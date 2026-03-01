import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.peca import PecaStatus


class PecaBase(BaseModel):
    codigo: str
    descricao: str
    pedido: Optional[str] = None
    quantidade: int = 1
    data_entrega: date
    status: PecaStatus = PecaStatus.em_fila


class PecaCreate(PecaBase):
    cliente_id: uuid.UUID
    ordem_producao_id: uuid.UUID  # ID da OP já existente


class PecaUpdate(BaseModel):
    descricao: Optional[str] = None
    pedido: Optional[str] = None
    quantidade: Optional[int] = None
    data_entrega: Optional[date] = None
    status: Optional[PecaStatus] = None


class PecaStatusUpdate(BaseModel):
    status: PecaStatus


class PecaResponse(PecaBase):
    id: uuid.UUID
    ordem_producao_id: uuid.UUID
    cliente_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}