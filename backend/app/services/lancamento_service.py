import uuid
from datetime import date
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.lancamento import Lancamento
from app.schemas.lancamento import LancamentoCreate


async def get_lancamento_by_id(db: AsyncSession, lancamento_id: uuid.UUID) -> Lancamento:
    result = await db.execute(select(Lancamento).where(Lancamento.id == lancamento_id))
    lancamento = result.scalar_one_or_none()
    if not lancamento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lançamento não encontrado"
        )
    return lancamento


async def list_lancamentos(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    tipo: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
) -> List[Lancamento]:
    query = select(Lancamento)

    filters = []
    if tipo:
        filters.append(Lancamento.tipo == tipo)
    if data_inicio:
        filters.append(Lancamento.data >= data_inicio)
    if data_fim:
        filters.append(Lancamento.data <= data_fim)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(Lancamento.data.desc(), Lancamento.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_lancamento(db: AsyncSession, data: LancamentoCreate) -> Lancamento:
    lancamento = Lancamento(**data.model_dump())
    db.add(lancamento)
    await db.commit()
    await db.refresh(lancamento)
    return lancamento


async def delete_lancamento(db: AsyncSession, lancamento_id: uuid.UUID) -> None:
    lancamento = await get_lancamento_by_id(db, lancamento_id)
    await db.delete(lancamento)
    await db.commit()


async def get_resumo(
    db: AsyncSession,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
) -> dict:
    base_filters = []
    if data_inicio:
        base_filters.append(Lancamento.data >= data_inicio)
    if data_fim:
        base_filters.append(Lancamento.data <= data_fim)

    # Total receitas
    q_rec = select(func.coalesce(func.sum(Lancamento.valor), 0)).where(
        and_(Lancamento.tipo == "receita", *base_filters)
    )
    result_rec = await db.execute(q_rec)
    total_receitas = float(result_rec.scalar())

    # Total despesas
    q_desp = select(func.coalesce(func.sum(Lancamento.valor), 0)).where(
        and_(Lancamento.tipo == "despesa", *base_filters)
    )
    result_desp = await db.execute(q_desp)
    total_despesas = float(result_desp.scalar())

    return {
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "saldo": total_receitas - total_despesas,
    }
