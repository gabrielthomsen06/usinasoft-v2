import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_active_user
from app.models.usuario import Usuario
from app.schemas.ordem_producao import (
    OrdemProducaoCreate,
    OrdemProducaoResponse,
    OrdemProducaoUpdate,
)
from app.services.op_service import (
    list_ops,
    get_op_by_id,
    create_op,
    update_op,
    delete_op,
)

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/", response_model=List[OrdemProducaoResponse])
async def list_all_ops(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> List:
    return await list_ops(db, skip=skip, limit=limit)


@router.post("/", response_model=OrdemProducaoResponse, status_code=status.HTTP_201_CREATED)
async def create_op_route(
    data: OrdemProducaoCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> OrdemProducaoResponse:
    return await create_op(db, data)


@router.get("/{op_id}", response_model=OrdemProducaoResponse)
async def get_op_route(
    op_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> OrdemProducaoResponse:
    return await get_op_by_id(db, op_id)


@router.put("/{op_id}", response_model=OrdemProducaoResponse)
async def update_op_route(
    op_id: uuid.UUID,
    data: OrdemProducaoUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> OrdemProducaoResponse:
    return await update_op(db, op_id, data)


@router.delete("/{op_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_op_route(
    op_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> None:
    await delete_op(db, op_id)
