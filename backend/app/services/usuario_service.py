import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import hash_password
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioSelfUpdate
from typing import Union


async def get_usuario_by_id(db: AsyncSession, user_id: uuid.UUID) -> Usuario:
    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def get_usuario_by_email(db: AsyncSession, email: str) -> Optional[Usuario]:
    result = await db.execute(select(Usuario).where(Usuario.email == email))
    return result.scalar_one_or_none()


async def list_usuarios(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Usuario]:
    result = await db.execute(select(Usuario).offset(skip).limit(limit))
    return list(result.scalars().all())


async def create_usuario(db: AsyncSession, data: UsuarioCreate) -> Usuario:
    existing = await get_usuario_by_email(db, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = Usuario(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


_USUARIO_ALLOWED_FIELDS = {"email", "first_name", "last_name", "password_hash", "is_active", "role"}


async def update_usuario(
    db: AsyncSession, user_id: uuid.UUID, data: Union[UsuarioUpdate, UsuarioSelfUpdate]
) -> Usuario:
    user = await get_usuario_by_id(db, user_id)
    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    for field, value in update_data.items():
        if field not in _USUARIO_ALLOWED_FIELDS:
            continue
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return user


async def delete_usuario(
    db: AsyncSession, user_id: uuid.UUID, requesting_user_id: uuid.UUID
) -> None:
    if user_id == requesting_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode deletar sua própria conta.",
        )
    user = await get_usuario_by_id(db, user_id)
    if user.role == "admin":
        result = await db.execute(
            select(Usuario).where(Usuario.role == "admin", Usuario.is_active == True)
        )
        active_admins = result.scalars().all()
        if len(active_admins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é possível deletar o único administrador ativo do sistema.",
            )
    await db.delete(user)
    await db.flush()
