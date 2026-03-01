import enum
import uuid
from datetime import date, datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.cliente import Cliente
    from app.models.ordem_producao import OrdemProducao


class PecaStatus(str, enum.Enum):
    em_fila = "em_fila"
    em_andamento = "em_andamento"
    pausada = "pausada"
    concluida = "concluida"
    cancelada = "cancelada"


class Peca(Base):
    __tablename__ = "pecas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ordem_producao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ordens_producao.id"), nullable=False
    )
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False
    )
    codigo: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    pedido: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    quantidade: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    data_entrega: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PecaStatus] = mapped_column(
        Enum(PecaStatus, name="pecastatus"),
        default=PecaStatus.em_fila,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    ordem_producao: Mapped["OrdemProducao"] = relationship(
        "OrdemProducao", back_populates="pecas"
    )
    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="pecas")