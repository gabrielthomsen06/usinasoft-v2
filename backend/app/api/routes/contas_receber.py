import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_admin_user
from app.models.usuario import Usuario
from app.schemas.conta_receber import ContaReceberCreate, ContaReceberResponse, ContaReceberUpdate
from app.schemas.nfe import (
    ImportNFeReceberRequest,
    ImportNFeReceberResponse,
    PreviewNFeReceberResponse,
)
from app.services.conta_receber_service import (
    list_contas_receber,
    get_conta_receber_by_id,
    create_conta_receber,
    update_conta_receber,
    delete_conta_receber,
)
from app.services.nota_fiscal_service import import_nfe_receber, preview_nfe_receber

router = APIRouter(prefix="/contas-receber", tags=["contas-receber"])


MAX_XML_SIZE = 1 * 1024 * 1024  # 1 MB
MAX_PDF_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_MIMES_XML = ("text/xml", "application/xml", "application/octet-stream")
ALLOWED_MIMES_PDF = ("application/pdf", "application/octet-stream")


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


@router.post("/", response_model=List[ContaReceberResponse], status_code=status.HTTP_201_CREATED)
async def create_conta_receber_route(
    data: ContaReceberCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> List[ContaReceberResponse]:
    return await create_conta_receber(db, data)


@router.post("/preview-nfe", response_model=PreviewNFeReceberResponse)
async def preview_nfe_receber_route(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> PreviewNFeReceberResponse:
    filename = (file.filename or "").lower()
    is_pdf = filename.endswith(".pdf") or file.content_type == "application/pdf"

    if is_pdf:
        if file.content_type and file.content_type not in ALLOWED_MIMES_PDF:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_CONTENT_TYPE", "message": "Envie um arquivo PDF"},
            )
        max_size = MAX_PDF_SIZE
    else:
        if file.content_type and file.content_type not in ALLOWED_MIMES_XML:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_CONTENT_TYPE", "message": "Envie XML ou PDF"},
            )
        max_size = MAX_XML_SIZE

    content = await file.read(max_size + 1)
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"Arquivo maior que {max_size // (1024*1024)} MB",
            },
        )

    return await preview_nfe_receber(db, content, is_pdf=is_pdf)


@router.post("/import-nfe", response_model=ImportNFeReceberResponse, status_code=status.HTTP_201_CREATED)
async def import_nfe_receber_route(
    payload: ImportNFeReceberRequest,
    db: AsyncSession = Depends(get_db),
    user: Usuario = Depends(get_current_admin_user),
) -> ImportNFeReceberResponse:
    return await import_nfe_receber(db, payload, user)


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
