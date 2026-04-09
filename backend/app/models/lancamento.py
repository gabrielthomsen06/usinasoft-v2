import uuid
from datetime import date, datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.conta_receber import ContaReceber
    from app.models.conta_pagar import ContaPagar


class Lancamento(Base):
    __tablename__ = "lancamentos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # receita | despesa
    descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    conta_receber_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contas_receber.id"), nullable=True
    )
    conta_pagar_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contas_pagar.id"), nullable=True
    )
    observacoes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    conta_receber: Mapped[Optional["ContaReceber"]] = relationship("ContaReceber", lazy="selectin")
    conta_pagar: Mapped[Optional["ContaPagar"]] = relationship("ContaPagar", lazy="selectin")
