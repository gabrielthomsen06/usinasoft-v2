import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, computed_field

from app.models.ordem_producao import OrdemProducaoStatus
from app.schemas.peca import PecaResponse


class OrdemProducaoBase(BaseModel):
    codigo: str
    cliente_id: uuid.UUID
    status: OrdemProducaoStatus = OrdemProducaoStatus.aberta
    observacoes: Optional[str] = None


class OrdemProducaoCreate(OrdemProducaoBase):
    pass


class OrdemProducaoUpdate(BaseModel):
    codigo: Optional[str] = None
    cliente_id: Optional[uuid.UUID] = None
    status: Optional[OrdemProducaoStatus] = None
    observacoes: Optional[str] = None


class OrdemProducaoResponse(OrdemProducaoBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    pecas: List[PecaResponse] = []

    @computed_field  # type: ignore[misc]
    @property
    def total_pecas(self) -> int:
        return len(self.pecas)

    @computed_field  # type: ignore[misc]
    @property
    def pecas_concluidas(self) -> int:
        return sum(1 for p in self.pecas if p.status.value == "concluida")

    @computed_field  # type: ignore[misc]
    @property
    def percentual_conclusao(self) -> float:
        if not self.pecas:
            return 0.0
        return round((self.pecas_concluidas / self.total_pecas) * 100, 2)

    model_config = {"from_attributes": True}
