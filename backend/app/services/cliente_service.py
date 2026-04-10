import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.cliente import Cliente
from app.models.ordem_producao import OrdemProducao
from app.models.peca import Peca
from app.schemas.cliente import ClienteCreate, ClienteUpdate


async def get_cliente_by_id(db: AsyncSession, cliente_id: uuid.UUID) -> Cliente:
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado"
        )
    return cliente


async def list_clientes(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Cliente]:
    result = await db.execute(select(Cliente).offset(skip).limit(limit))
    return list(result.scalars().all())


async def create_cliente(db: AsyncSession, data: ClienteCreate) -> Cliente:
    cliente = Cliente(**data.model_dump())
    db.add(cliente)
    await db.flush()
    await db.refresh(cliente)
    return cliente


async def update_cliente(
    db: AsyncSession, cliente_id: uuid.UUID, data: ClienteUpdate
) -> Cliente:
    cliente = await get_cliente_by_id(db, cliente_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cliente, field, value)
    await db.flush()
    await db.refresh(cliente)
    return cliente


async def delete_cliente(db: AsyncSession, cliente_id: uuid.UUID) -> None:
    cliente = await get_cliente_by_id(db, cliente_id)

    ops_result = await db.execute(
        select(OrdemProducao).where(OrdemProducao.cliente_id == cliente_id).limit(1)
    )
    if ops_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não é possível excluir o cliente pois existem Ordens de Produção vinculadas.",
        )

    pecas_result = await db.execute(
        select(Peca).where(Peca.cliente_id == cliente_id).limit(1)
    )
    if pecas_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não é possível excluir o cliente pois existem Peças vinculadas.",
        )

    await db.delete(cliente)
    await db.flush()