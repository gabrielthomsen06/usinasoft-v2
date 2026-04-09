import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_admin_user
from app.models.usuario import Usuario
from app.schemas.conta_receber import ContaReceberCreate, ContaReceberResponse, ContaReceberUpdate
from app.services.conta_receber_service import (
    list_contas_receber,
    get_conta_receber_by_id,
    create_conta_receber,
    update_conta_receber,
    delete_conta_receber,
)

router = APIRouter(prefix="/contas-receber", tags=["contas-receber"])


@router.get("/", response_model=List[ContaReceberResponse])
async def list_all_contas_receber(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = Query(None, alias="status"),
    cliente_id: Optional[uuid.UUID] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> List:
    return await list_contas_receber(
        db, skip=skip, limit=limit, status_filter=status_filter,
        cliente_id=cliente_id, data_inicio=data_inicio, data_fim=data_fim,
    )


@router.post("/", response_model=ContaReceberResponse, status_code=status.HTTP_201_CREATED)
async def create_conta_receber_route(
    data: ContaReceberCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> ContaReceberResponse:
    return await create_conta_receber(db, data)


@router.get("/{conta_id}", response_model=ContaReceberResponse)
async def get_conta_receber_route(
    conta_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> ContaReceberResponse:
    return await get_conta_receber_by_id(db, conta_id)


@router.put("/{conta_id}", response_model=ContaReceberResponse)
async def update_conta_receber_route(
    conta_id: uuid.UUID,
    data: ContaReceberUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> ContaReceberResponse:
    return await update_conta_receber(db, conta_id, data)


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conta_receber_route(
    conta_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> None:
    await delete_conta_receber(db, conta_id)
