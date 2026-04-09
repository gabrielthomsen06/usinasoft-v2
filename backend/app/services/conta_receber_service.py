import uuid
from datetime import date
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.conta_receber import ContaReceber
from app.models.lancamento import Lancamento
from app.schemas.conta_receber import ContaReceberCreate, ContaReceberUpdate


async def get_conta_receber_by_id(db: AsyncSession, conta_id: uuid.UUID) -> ContaReceber:
    result = await db.execute(select(ContaReceber).where(ContaReceber.id == conta_id))
    conta = result.scalar_one_or_none()
    if not conta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conta a receber não encontrada"
        )
    return conta


async def list_contas_receber(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    cliente_id: Optional[uuid.UUID] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
) -> List[ContaReceber]:
    query = select(ContaReceber)

    filters = []
    if status_filter:
        filters.append(ContaReceber.status == status_filter)
    if cliente_id:
        filters.append(ContaReceber.cliente_id == cliente_id)
    if data_inicio:
        filters.append(ContaReceber.data_vencimento >= data_inicio)
    if data_fim:
        filters.append(ContaReceber.data_vencimento <= data_fim)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(ContaReceber.data_vencimento.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_conta_receber(db: AsyncSession, data: ContaReceberCreate) -> ContaReceber:
    conta = ContaReceber(**data.model_dump())
    db.add(conta)
    await db.commit()
    await db.refresh(conta)
    return conta


async def update_conta_receber(
    db: AsyncSession, conta_id: uuid.UUID, data: ContaReceberUpdate
) -> ContaReceber:
    conta = await get_conta_receber_by_id(db, conta_id)

    update_data = data.model_dump(exclude_unset=True)

    # Auto-create lancamento when marking as paid
    was_pending = conta.status != "pago"
    new_status = update_data.get("status")

    for field, value in update_data.items():
        setattr(conta, field, value)

    if was_pending and new_status == "pago":
        if not conta.data_pagamento:
            conta.data_pagamento = date.today()
        lancamento = Lancamento(
            tipo="receita",
            descricao=f"Recebimento: {conta.descricao}",
            valor=conta.valor,
            data=conta.data_pagamento,
            conta_receber_id=conta.id,
        )
        db.add(lancamento)

    await db.commit()
    await db.refresh(conta)
    return conta


async def delete_conta_receber(db: AsyncSession, conta_id: uuid.UUID) -> None:
    conta = await get_conta_receber_by_id(db, conta_id)
    # Deletar lançamentos vinculados primeiro (FK constraint)
    result = await db.execute(
        select(Lancamento).where(Lancamento.conta_receber_id == conta_id)
    )
    for lanc in result.scalars().all():
        await db.delete(lanc)
    await db.delete(conta)
    await db.commit()
