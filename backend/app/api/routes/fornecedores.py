import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_admin_user
from app.models.usuario import Usuario
from app.schemas.fornecedor import FornecedorCreate, FornecedorResponse, FornecedorUpdate
from app.services.fornecedor_service import (
    list_fornecedores,
    get_fornecedor_by_id,
    create_fornecedor,
    update_fornecedor,
    delete_fornecedor,
)

router = APIRouter(prefix="/fornecedores", tags=["fornecedores"])


@router.get("/", response_model=List[FornecedorResponse])
async def list_all_fornecedores(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> List:
    return await list_fornecedores(db, skip=skip, limit=limit)


@router.post("/", response_model=FornecedorResponse, status_code=status.HTTP_201_CREATED)
async def create_fornecedor_route(
    data: FornecedorCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> FornecedorResponse:
    return await create_fornecedor(db, data)


@router.get("/{fornecedor_id}", response_model=FornecedorResponse)
async def get_fornecedor_route(
    fornecedor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> FornecedorResponse:
    return await get_fornecedor_by_id(db, fornecedor_id)


@router.put("/{fornecedor_id}", response_model=FornecedorResponse)
async def update_fornecedor_route(
    fornecedor_id: uuid.UUID,
    data: FornecedorUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> FornecedorResponse:
    return await update_fornecedor(db, fornecedor_id, data)


@router.delete("/{fornecedor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fornecedor_route(
    fornecedor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> None:
    await delete_fornecedor(db, fornecedor_id)
