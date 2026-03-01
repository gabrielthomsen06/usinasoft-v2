import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ordem_producao import OrdemProducao, OrdemProducaoStatus
from app.models.peca import PecaStatus
from app.schemas.ordem_producao import OrdemProducaoCreate, OrdemProducaoUpdate


async def get_op_by_id(db: AsyncSession, op_id: uuid.UUID) -> OrdemProducao:
    result = await db.execute(
        select(OrdemProducao)
        .where(OrdemProducao.id == op_id)
        .options(selectinload(OrdemProducao.pecas))
    )
    op = result.scalar_one_or_none()
    if not op:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ordem de produção não encontrada"
        )
    return op


async def get_op_by_codigo(db: AsyncSession, codigo: str) -> Optional[OrdemProducao]:
    result = await db.execute(
        select(OrdemProducao)
        .where(OrdemProducao.codigo == codigo)
        .options(selectinload(OrdemProducao.pecas))
    )
    return result.scalar_one_or_none()


async def list_ops(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[OrdemProducao]:
    result = await db.execute(
        select(OrdemProducao)
        .options(selectinload(OrdemProducao.pecas))
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def create_op(db: AsyncSession, data: OrdemProducaoCreate) -> OrdemProducao:
    existing = await get_op_by_codigo(db, data.codigo)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma OP com este código",
        )
    op = OrdemProducao(**data.model_dump())
    db.add(op)
    await db.commit()
    await db.refresh(op)
    return await get_op_by_id(db, op.id)


async def update_op(db: AsyncSession, op_id: uuid.UUID, data: OrdemProducaoUpdate) -> OrdemProducao:
    op = await get_op_by_id(db, op_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(op, field, value)
    await db.commit()
    return await get_op_by_id(db, op.id)


async def delete_op(db: AsyncSession, op_id: uuid.UUID) -> None:
    op = await get_op_by_id(db, op_id)
    await db.delete(op)
    await db.commit()


async def auto_update_op_status(db: AsyncSession, op_id: uuid.UUID) -> None:
    """Recalcula e atualiza o status da OP com base nas peças."""
    op = await get_op_by_id(db, op_id)
    pecas = op.pecas

    if not pecas:
        return

    active_pecas = [p for p in pecas if p.status != PecaStatus.cancelada]
    if not active_pecas:
        return

    all_concluida = all(p.status == PecaStatus.concluida for p in active_pecas)
    any_in_progress = any(
        p.status in (PecaStatus.em_andamento, PecaStatus.pausada) for p in active_pecas
    )

    if all_concluida:
        op.status = OrdemProducaoStatus.concluida
    elif any_in_progress:
        op.status = OrdemProducaoStatus.em_andamento
    else:
        op.status = OrdemProducaoStatus.aberta

    await db.commit()