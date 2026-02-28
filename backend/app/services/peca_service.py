import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cliente import Cliente
from app.models.ordem_producao import OrdemProducao, OrdemProducaoStatus
from app.models.peca import Peca, PecaStatus
from app.schemas.peca import PecaCreate, PecaUpdate, PecaStatusUpdate
from app.services.op_service import get_op_by_codigo, auto_update_op_status


async def get_peca_by_id(db: AsyncSession, peca_id: uuid.UUID) -> Peca:
    result = await db.execute(select(Peca).where(Peca.id == peca_id))
    peca = result.scalar_one_or_none()
    if not peca:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Peça not found"
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


async def _get_or_create_op(
    db: AsyncSession, ordem_producao_codigo: str, cliente_id: uuid.UUID
) -> OrdemProducao:
    """Find existing OP by codigo, or create a new one."""
    op = await get_op_by_codigo(db, ordem_producao_codigo)
    if op:
        return op

    # Verify client exists
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )

    op = OrdemProducao(
        codigo=ordem_producao_codigo,
        cliente_id=cliente_id,
        status=OrdemProducaoStatus.aberta,
    )
    db.add(op)
    await db.flush()
    await db.refresh(op)
    return op


async def create_peca(db: AsyncSession, data: PecaCreate) -> Peca:
    op = await _get_or_create_op(db, data.ordem_producao_codigo, data.cliente_id)
    peca_data = data.model_dump(exclude={"ordem_producao_codigo"})
    peca = Peca(ordem_producao_id=op.id, **peca_data)
    db.add(peca)
    await db.flush()
    await db.refresh(peca)
    await auto_update_op_status(db, op.id)
    return peca


async def update_peca(
    db: AsyncSession, peca_id: uuid.UUID, data: PecaUpdate
) -> Peca:
    peca = await get_peca_by_id(db, peca_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(peca, field, value)
    await db.flush()
    await db.refresh(peca)
    await auto_update_op_status(db, peca.ordem_producao_id)
    return peca


async def update_peca_status(
    db: AsyncSession, peca_id: uuid.UUID, data: PecaStatusUpdate
) -> Peca:
    peca = await get_peca_by_id(db, peca_id)
    peca.status = data.status
    await db.flush()
    await db.refresh(peca)
    await auto_update_op_status(db, peca.ordem_producao_id)
    return peca


async def delete_peca(db: AsyncSession, peca_id: uuid.UUID) -> None:
    peca = await get_peca_by_id(db, peca_id)
    op_id = peca.ordem_producao_id
    await db.delete(peca)
    await db.flush()
    await auto_update_op_status(db, op_id)
