import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_active_user
from app.models.peca import PecaStatus
from app.models.usuario import Usuario
from app.schemas.peca import PecaCreate, PecaResponse, PecaStatusUpdate, PecaUpdate
from app.services.peca_service import (
    list_pecas,
    get_peca_by_id,
    create_peca,
    update_peca,
    update_peca_status,
    delete_peca,
)

router = APIRouter(prefix="/pecas", tags=["pecas"])


@router.get("/", response_model=List[PecaResponse])
async def list_all_pecas(
    skip: int = 0,
    limit: int = 100,
    status: Optional[PecaStatus] = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> List:
    return await list_pecas(db, skip=skip, limit=limit, status_filter=status)


@router.post("/", response_model=PecaResponse, status_code=status.HTTP_201_CREATED)
async def create_peca_route(
    data: PecaCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> PecaResponse:
    return await create_peca(db, data)


@router.get("/{peca_id}", response_model=PecaResponse)
async def get_peca_route(
    peca_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> PecaResponse:
    return await get_peca_by_id(db, peca_id)


@router.put("/{peca_id}", response_model=PecaResponse)
async def update_peca_route(
    peca_id: uuid.UUID,
    data: PecaUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> PecaResponse:
    return await update_peca(db, peca_id, data)


@router.patch("/{peca_id}/status", response_model=PecaResponse)
async def update_peca_status_route(
    peca_id: uuid.UUID,
    data: PecaStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> PecaResponse:
    return await update_peca_status(db, peca_id, data)


@router.delete("/{peca_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_peca_route(
    peca_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> None:
    await delete_peca(db, peca_id)
