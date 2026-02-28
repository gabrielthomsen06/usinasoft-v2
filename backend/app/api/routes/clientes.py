import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_active_user
from app.models.usuario import Usuario
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate
from app.services.cliente_service import (
    list_clientes,
    get_cliente_by_id,
    create_cliente,
    update_cliente,
    delete_cliente,
)

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("/", response_model=List[ClienteResponse])
async def list_all_clientes(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> List:
    return await list_clientes(db, skip=skip, limit=limit)


@router.post("/", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
async def create_cliente_route(
    data: ClienteCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> ClienteResponse:
    return await create_cliente(db, data)


@router.get("/{cliente_id}", response_model=ClienteResponse)
async def get_cliente_route(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> ClienteResponse:
    return await get_cliente_by_id(db, cliente_id)


@router.put("/{cliente_id}", response_model=ClienteResponse)
async def update_cliente_route(
    cliente_id: uuid.UUID,
    data: ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> ClienteResponse:
    return await update_cliente(db, cliente_id, data)


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cliente_route(
    cliente_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> None:
    await delete_cliente(db, cliente_id)
