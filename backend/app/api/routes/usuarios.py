import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_active_user
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioResponse, UsuarioUpdate
from app.services.usuario_service import (
    list_usuarios,
    get_usuario_by_id,
    update_usuario,
    delete_usuario,
)

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("/me", response_model=UsuarioResponse)
async def get_me(
    current_user: Usuario = Depends(get_current_active_user),
) -> Usuario:
    return current_user


@router.put("/me", response_model=UsuarioResponse)
async def update_me(
    data: UsuarioUpdate,
    current_user: Usuario = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    return await update_usuario(db, current_user.id, data)


@router.get("/", response_model=List[UsuarioResponse])
async def list_all_usuarios(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> List[Usuario]:
    return await list_usuarios(db, skip=skip, limit=limit)


@router.get("/{user_id}", response_model=UsuarioResponse)
async def get_usuario(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> Usuario:
    return await get_usuario_by_id(db, user_id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_usuario_route(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> None:
    await delete_usuario(db, user_id)
