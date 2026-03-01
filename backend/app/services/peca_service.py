import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cliente import Cliente
from app.models.ordem_producao import OrdemProducao, OrdemProducaoStatus
from app.models.peca import Peca, PecaStatus
from app.schemas.peca import PecaCreate, PecaUpdate, PecaStatusUpdate
from app.services.op_service import get_op_by_id, auto_update_op_status


async def get_peca_by_id(db: AsyncSession, peca_id: uuid.UUID) -> Peca:
    result = await db.execute(select(Peca).where(Peca.id == peca_id))
    peca = result.scalar_one_or_none()
    if not peca:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Peça não encontrada"
        )
    return peca


async def list_pecas(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[PecaStatus] = None,
) -> List[Peca]:
    query = select(Peca)
    if status_filter:
        query = query.where(Peca.status == status_filter)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_peca(db: AsyncSession, data: PecaCreate) -> Peca:
    # Verifica se a OP existe
    op = await get_op_by_id(db, data.ordem_producao_id)

    # Verifica se o cliente existe
    result = await db.execute(select(Cliente).where(Cliente.id == data.cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado"
        )

    peca_data = data.model_dump()
    peca = Peca(**peca_data)
    db.add(peca)
    await db.commit()
    await db.refresh(peca)
    await auto_update_op_status(db, op.id)
    return peca


async def update_peca(db: AsyncSession, peca_id: uuid.UUID, data: PecaUpdate) -> Peca:
    peca = await get_peca_by_id(db, peca_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(peca, field, value)
    await db.commit()
    await db.refresh(peca)
    await auto_update_op_status(db, peca.ordem_producao_id)
    return peca


async def update_peca_status(db: AsyncSession, peca_id: uuid.UUID, data: PecaStatusUpdate) -> Peca:
    peca = await get_peca_by_id(db, peca_id)
    peca.status = data.status
    await db.commit()
    await db.refresh(peca)
    await auto_update_op_status(db, peca.ordem_producao_id)
    return peca


async def delete_peca(db: AsyncSession, peca_id: uuid.UUID) -> None:
    peca = await get_peca_by_id(db, peca_id)
    op_id = peca.ordem_producao_id
    await db.delete(peca)
    await db.commit()
    await auto_update_op_status(db, op_id)