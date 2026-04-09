import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_admin_user
from app.models.usuario import Usuario
from app.schemas.conta_pagar import ContaPagarCreate, ContaPagarResponse, ContaPagarUpdate
from app.services.conta_pagar_service import (
    list_contas_pagar,
    get_conta_pagar_by_id,
    create_conta_pagar,
    update_conta_pagar,
    delete_conta_pagar,
)

router = APIRouter(prefix="/contas-pagar", tags=["contas-pagar"])


@router.get("/", response_model=List[ContaPagarResponse])
async def list_all_contas_pagar(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = Query(None, alias="status"),
    categoria: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> List:
    return await list_contas_pagar(
        db, skip=skip, limit=limit, status_filter=status_filter,
        categoria=categoria, data_inicio=data_inicio, data_fim=data_fim,
    )


@router.post("/", response_model=List[ContaPagarResponse], status_code=status.HTTP_201_CREATED)
async def create_conta_pagar_route(
    data: ContaPagarCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> List[ContaPagarResponse]:
    return await create_conta_pagar(db, data)


@router.get("/{conta_id}", response_model=ContaPagarResponse)
async def get_conta_pagar_route(
    conta_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> ContaPagarResponse:
    return await get_conta_pagar_by_id(db, conta_id)


@router.put("/{conta_id}", response_model=ContaPagarResponse)
async def update_conta_pagar_route(
    conta_id: uuid.UUID,
    data: ContaPagarUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> ContaPagarResponse:
    return await update_conta_pagar(db, conta_id, data)


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conta_pagar_route(
    conta_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> None:
    await delete_conta_pagar(db, conta_id)
