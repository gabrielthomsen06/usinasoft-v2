import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.conta_pagar import ContaPagar
from app.models.fornecedor import Fornecedor
from app.models.nota_fiscal import NotaFiscal
from app.models.usuario import Usuario
from app.schemas.nfe import (
    FornecedorVinculado,
    ImportNFeRequest,
    ImportNFeResponse,
    NFeParsedData,
    PreviewNFeResponse,
    PreviewSugestoes,
)
from app.services.nfe_parser import parse_nfe_xml, NFeParserError


async def _find_existing_nota(
    db: AsyncSession, chave: str
) -> Optional[NotaFiscal]:
    result = await db.execute(
        select(NotaFiscal).where(NotaFiscal.chave_acesso == chave)
    )
    return result.scalar_one_or_none()


async def _find_contas_by_grupo(
    db: AsyncSession, grupo_id: Optional[uuid.UUID]
) -> List[uuid.UUID]:
    if grupo_id is None:
        return []
    result = await db.execute(
        select(ContaPagar.id).where(ContaPagar.grupo_parcelas_id == grupo_id)
    )
    return [r for r in result.scalars().all()]


def _format_observacoes(parsed: NFeParsedData) -> str:
    chave_fmt = " ".join(
        parsed.chave_acesso[i:i + 4] for i in range(0, len(parsed.chave_acesso), 4)
    )
    linhas = [f"Chave: {chave_fmt}", "Itens:"]
    for it in parsed.itens:
        qtd_str = f"{it.quantidade.normalize():f}"
        if "." in qtd_str:
            qtd_str = qtd_str.rstrip("0").rstrip(".")
        linhas.append(
            f"- {qtd_str}x {it.descricao} (R$ {it.valor_total:.2f})"
        )
    return "\n".join(linhas)


def _build_sugestoes(parsed: NFeParsedData) -> PreviewSugestoes:
    nome_curto = parsed.emitente_fantasia or parsed.emitente_nome
    return PreviewSugestoes(
        descricao=f"NF-e nº {parsed.numero_nota} - {nome_curto}",
        categoria="material",
        observacoes=_format_observacoes(parsed),
    )


async def preview_nfe(
    db: AsyncSession, xml_bytes: bytes
) -> PreviewNFeResponse:
    try:
        parsed = parse_nfe_xml(xml_bytes)
    except NFeParserError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": e.code, "message": e.message},
        )

    existing = await _find_existing_nota(db, parsed.chave_acesso)
    if existing:
        contas_ids = await _find_contas_by_grupo(db, existing.grupo_parcelas_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "DUPLICATE",
                "chave_acesso": existing.chave_acesso,
                "importada_em": existing.created_at.date().isoformat(),
                "contas_pagar_ids": [str(c) for c in contas_ids],
            },
        )

    fornecedor_link = None
    forn_result = await db.execute(
        select(Fornecedor).where(Fornecedor.cnpj_cpf == parsed.emitente_cnpj)
    )
    forn = forn_result.scalar_one_or_none()
    if forn:
        fornecedor_link = FornecedorVinculado(id=forn.id, nome=forn.nome)

    return PreviewNFeResponse(
        parsed=parsed,
        fornecedor=fornecedor_link,
        sugestoes=_build_sugestoes(parsed),
    )


async def import_nfe(
    db: AsyncSession, payload: ImportNFeRequest, user: Usuario
) -> ImportNFeResponse:
    existing = await _find_existing_nota(db, payload.chave_acesso)
    if existing:
        contas_ids = await _find_contas_by_grupo(db, existing.grupo_parcelas_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "DUPLICATE",
                "chave_acesso": existing.chave_acesso,
                "importada_em": existing.created_at.date().isoformat(),
                "contas_pagar_ids": [str(c) for c in contas_ids],
            },
        )

    if payload.fornecedor.id:
        forn_result = await db.execute(
            select(Fornecedor).where(Fornecedor.id == payload.fornecedor.id)
        )
        fornecedor = forn_result.scalar_one_or_none()
        if not fornecedor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fornecedor não encontrado",
            )
    else:
        fornecedor = Fornecedor(
            id=uuid.uuid4(),
            nome=payload.fornecedor.nome,
            cnpj_cpf=payload.fornecedor.cnpj,
            email=payload.fornecedor.email,
        )
        db.add(fornecedor)
        await db.flush()

    n = len(payload.parcelas)
    if n == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_PARCELAS", "message": "Pelo menos uma parcela é obrigatória"},
        )

    grupo_id = uuid.uuid4()
    intervalo: Optional[int] = None
    if n > 1:
        intervalo = (payload.parcelas[1].vencimento - payload.parcelas[0].vencimento).days

    contas: List[ContaPagar] = []
    for i, parcela in enumerate(payload.parcelas):
        descricao = payload.descricao
        if n > 1:
            descricao = f"{payload.descricao} ({i + 1}/{n})"
        conta = ContaPagar(
            id=uuid.uuid4(),
            descricao=descricao,
            fornecedor_id=fornecedor.id,
            valor=float(parcela.valor),
            data_emissao=payload.data_emissao,
            data_vencimento=parcela.vencimento,
            categoria=payload.categoria,
            parcela_atual=i + 1,
            total_parcelas=n,
            grupo_parcelas_id=grupo_id,
            intervalo_dias=intervalo,
            observacoes=payload.observacoes,
        )
        db.add(conta)
        contas.append(conta)

    nota = NotaFiscal(
        id=uuid.uuid4(),
        chave_acesso=payload.chave_acesso,
        numero_nota="",
        serie=None,
        modelo="55",
        cnpj_emitente=payload.fornecedor.cnpj,
        nome_emitente=payload.fornecedor.nome,
        valor_total=sum(float(p.valor) for p in payload.parcelas),
        data_emissao=payload.data_emissao,
        grupo_parcelas_id=grupo_id,
        created_by_user_id=user.id,
    )
    db.add(nota)

    await db.flush()

    return ImportNFeResponse(
        contas_pagar_ids=[c.id for c in contas],
        fornecedor_id=fornecedor.id,
        nota_fiscal_id=nota.id,
    )
