import uuid
from datetime import date, datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.cliente import Cliente
    from app.models.ordem_producao import OrdemProducao


class ContaReceber(Base):
    __tablename__ = "contas_receber"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False
    )
    ordem_producao_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ordens_producao.id"), nullable=True
    )
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    data_emissao: Mapped[date] = mapped_column(Date, nullable=False)
    data_vencimento: Mapped[date] = mapped_column(Date, nullable=False)
    data_pagamento: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pendente", server_default="pendente", nullable=False
    )
    parcela_atual: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    total_parcelas: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    grupo_parcelas_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    intervalo_dias: Mapped[Optional[int]] = mapped_column(nullable=True)
    observacoes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    cliente: Mapped["Cliente"] = relationship("Cliente", lazy="selectin")
    ordem_producao: Mapped[Optional["OrdemProducao"]] = relationship("OrdemProducao", lazy="selectin")
