import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.fornecedor import Fornecedor
from app.schemas.fornecedor import FornecedorCreate, FornecedorUpdate


async def get_fornecedor_by_id(db: AsyncSession, fornecedor_id: uuid.UUID) -> Fornecedor:
    result = await db.execute(select(Fornecedor).where(Fornecedor.id == fornecedor_id))
    fornecedor = result.scalar_one_or_none()
    if not fornecedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Fornecedor não encontrado"
        )
    return fornecedor


async def list_fornecedores(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Fornecedor]:
    result = await db.execute(select(Fornecedor).offset(skip).limit(limit))
    return list(result.scalars().all())


async def create_fornecedor(db: AsyncSession, data: FornecedorCreate) -> Fornecedor:
    fornecedor = Fornecedor(**data.model_dump())
    db.add(fornecedor)
    await db.commit()
    await db.refresh(fornecedor)
    return fornecedor


async def update_fornecedor(
    db: AsyncSession, fornecedor_id: uuid.UUID, data: FornecedorUpdate
) -> Fornecedor:
    fornecedor = await get_fornecedor_by_id(db, fornecedor_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(fornecedor, field, value)
    await db.commit()
    await db.refresh(fornecedor)
    return fornecedor


async def delete_fornecedor(db: AsyncSession, fornecedor_id: uuid.UUID) -> None:
    fornecedor = await get_fornecedor_by_id(db, fornecedor_id)
    await db.delete(fornecedor)
    await db.commit()
