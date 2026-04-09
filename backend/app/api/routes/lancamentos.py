import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_admin_user
from app.models.usuario import Usuario
from app.schemas.lancamento import LancamentoCreate, LancamentoResponse, ResumoFinanceiro
from app.services.lancamento_service import (
    list_lancamentos,
    create_lancamento,
    delete_lancamento,
    get_resumo,
)

router = APIRouter(prefix="/lancamentos", tags=["lancamentos"])


@router.get("/", response_model=List[LancamentoResponse])
async def list_all_lancamentos(
    skip: int = 0,
    limit: int = 100,
    tipo: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> List:
    return await list_lancamentos(
        db, skip=skip, limit=limit, tipo=tipo,
        data_inicio=data_inicio, data_fim=data_fim,
    )


@router.get("/resumo", response_model=ResumoFinanceiro)
async def get_resumo_financeiro(
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> dict:
    return await get_resumo(db, data_inicio=data_inicio, data_fim=data_fim)


@router.post("/", response_model=LancamentoResponse, status_code=status.HTTP_201_CREATED)
async def create_lancamento_route(
    data: LancamentoCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> LancamentoResponse:
    return await create_lancamento(db, data)


@router.delete("/{lancamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lancamento_route(
    lancamento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> None:
    await delete_lancamento(db, lancamento_id)
