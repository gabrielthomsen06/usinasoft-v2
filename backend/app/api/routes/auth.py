from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_active_user
from app.core.security import verify_token, create_access_token, create_refresh_token
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioResponse
from app.services.auth_service import authenticate_user, create_tokens
from app.services.usuario_service import create_usuario

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return create_tokens(str(user.id))


@router.post("/register", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> UsuarioResponse:
    return await create_usuario(db, data)


@router.post("/refresh")
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user_id = verify_token(refresh_token, token_type="refresh")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    new_access_token = create_access_token(subject=user_id)
    new_refresh_token = create_refresh_token(subject=user_id)
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }
