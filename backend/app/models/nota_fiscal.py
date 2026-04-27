import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class NotaFiscal(Base):
    __tablename__ = "notas_fiscais"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chave_acesso: Mapped[str] = mapped_column(
        String(44), unique=True, nullable=False, index=True
    )
    numero_nota: Mapped[str] = mapped_column(String(20), nullable=False)
    serie: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    modelo: Mapped[str] = mapped_column(String(2), nullable=False)
    cnpj_emitente: Mapped[str] = mapped_column(String(14), nullable=False, index=True)
    nome_emitente: Mapped[str] = mapped_column(String(255), nullable=False)
    valor_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    data_emissao: Mapped[date] = mapped_column(Date, nullable=False)
    grupo_parcelas_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False
    )
