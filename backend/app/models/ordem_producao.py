import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.cliente import Cliente
    from app.models.peca import Peca


class OrdemProducaoStatus(str, enum.Enum):
    aberta = "aberta"
    em_andamento = "em_andamento"
    concluida = "concluida"


class OrdemProducao(Base):
    __tablename__ = "ordens_producao"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    codigo: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False
    )
    status: Mapped[OrdemProducaoStatus] = mapped_column(
        Enum(OrdemProducaoStatus, name="ordemproducaostatus"),
        default=OrdemProducaoStatus.aberta,
        nullable=False,
    )
    observacoes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="ordens_producao")
    pecas: Mapped[list["Peca"]] = relationship("Peca", back_populates="ordem_producao")