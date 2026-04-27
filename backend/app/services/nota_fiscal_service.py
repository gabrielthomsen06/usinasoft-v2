import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.cliente import Cliente
from app.models.conta_pagar import ContaPagar
from app.models.conta_receber import ContaReceber
from app.models.fornecedor import Fornecedor
from app.models.nota_fiscal import NotaFiscal
from app.models.usuario import Usuario
from app.schemas.nfe import (
    FornecedorVinculado,
    ImportNFePagarRequest,
    ImportNFePagarResponse,
    ImportNFeReceberRequest,
    ImportNFeReceberResponse,
    NFeParsedData,
    PreviewNFePagarResponse,
    PreviewNFeReceberResponse,
    PreviewSugestoesPagar,
    PreviewSugestoesReceber,
)
from app.services.nfe_parser import parse_nfe_xml, NFeParserError


# ============= helpers =============

async def _find_existing_nota(
    db: AsyncSession, chave: str
) -> Optional[NotaFiscal]:
    result = await db.execute(
        select(NotaFiscal).where(NotaFiscal.chave_acesso == chave)
    )
    return result.scalar_one_or_none()


async def _find_contas_pagar_by_grupo(
    db: AsyncSession, grupo_id: Optional[uuid.UUID]
) -> List[uuid.UUID]:
    if grupo_id is None:
        return []
    result = await db.execute(
        select(ContaPagar.id).where(ContaPagar.grupo_parcelas_id == grupo_id)
    )
    return [r for r in result.scalars().all()]


async def _find_contas_receber_by_grupo(
    db: AsyncSession, grupo_id: Optional[uuid.UUID]
) -> List[uuid.UUID]:
    if grupo_id is None:
        return []
    result = await db.execute(
        select(ContaReceber.id).where(ContaReceber.grupo_parcelas_id == grupo_id)
    )
    return [r for r in result.scalars().all()]


def _format_chave(chave: str) -> str:
    return " ".join(chave[i:i + 4] for i in range(0, len(chave), 4))


def _format_observacoes(parsed: NFeParsedData) -> str:
    linhas = [f"Chave: {_format_chave(parsed.chave_acesso)}", "Itens:"]
    for it in parsed.itens:
        qtd_str = f"{it.quantidade.normalize():f}"
        if "." in qtd_str:
            qtd_str = qtd_str.rstrip("0").rstrip(".")
        linhas.append(
            f"- {qtd_str}x {it.descricao} (R$ {it.valor_total:.2f})"
        )
    return "\n".join(linhas)


def _raise_duplicate(existing: NotaFiscal, contas_ids: List[uuid.UUID]) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "DUPLICATE",
            "chave_acesso": existing.chave_acesso,
            "importada_em": existing.created_at.date().isoformat(),
            "direcao": existing.direcao,
            "contas_pagar_ids": [str(c) for c in contas_ids] if existing.direcao == "pagar" else [],
            "contas_receber_ids": [str(c) for c in contas_ids] if existing.direcao == "receber" else [],
        },
    )


def _raise_wrong_direction(expected: str, parsed: NFeParsedData) -> None:
    if expected == "pagar":
        msg = (
            "Esta NF-e foi emitida pela sua empresa — importe em Contas a Receber."
        )
    else:
        msg = (
            "Esta NF-e foi recebida por outra empresa — importe em Contas a Pagar."
        )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "code": "WRONG_DIRECTION",
            "message": msg,
            "emitente_cnpj": parsed.emitente_cnpj,
            "dest_cnpj_cpf": parsed.dest_cnpj_cpf,
        },
    )


def _empresa_cnpj() -> str:
    if not settings.EMPRESA_CNPJ:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "EMPRESA_CNPJ_NOT_CONFIGURED",
                "message": "Configure EMPRESA_CNPJ nas variáveis de ambiente.",
            },
        )
    return settings.EMPRESA_CNPJ


# ============= preview =============

def _parse_or_400(xml_bytes: bytes) -> NFeParsedData:
    try:
        return parse_nfe_xml(xml_bytes)
    except NFeParserError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": e.code, "message": e.message},
        )


async def preview_nfe_pagar(
    db: AsyncSession, xml_bytes: bytes
) -> PreviewNFePagarResponse:
    parsed = _parse_or_400(xml_bytes)

    empresa = _empresa_cnpj()
    if (parsed.dest_cnpj_cpf or "") != empresa:
        _raise_wrong_direction("pagar", parsed)

    existing = await _find_existing_nota(db, parsed.chave_acesso)
    if existing:
        contas_ids = await _find_contas_pagar_by_grupo(db, existing.grupo_parcelas_id)
        _raise_duplicate(existing, contas_ids)

    fornecedor_link = None
    forn_result = await db.execute(
        select(Fornecedor).where(Fornecedor.cnpj_cpf == parsed.emitente_cnpj)
    )
    forn = forn_result.scalar_one_or_none()
    if forn:
        fornecedor_link = FornecedorVinculado(id=forn.id, nome=forn.nome)

    nome_curto = parsed.emitente_fantasia or parsed.emitente_nome
    sugestoes = PreviewSugestoesPagar(
        descricao=f"NF-e nº {parsed.numero_nota} - {nome_curto}",
        categoria="material",
        observacoes=_format_observacoes(parsed),
    )

    return PreviewNFePagarResponse(
        parsed=parsed,
        fornecedor=fornecedor_link,
        sugestoes=sugestoes,
    )


async def preview_nfe_receber(
    db: AsyncSession, xml_bytes: bytes
) -> PreviewNFeReceberResponse:
    parsed = _parse_or_400(xml_bytes)

    empresa = _empresa_cnpj()
    if parsed.emitente_cnpj != empresa:
        _raise_wrong_direction("receber", parsed)

    if not parsed.dest_cnpj_cpf:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "MISSING_DEST",
                "message": "Esta NF-e não tem CNPJ/CPF de destinatário.",
            },
        )

    existing = await _find_existing_nota(db, parsed.chave_acesso)
    if existing:
        contas_ids = await _find_contas_receber_by_grupo(db, existing.grupo_parcelas_id)
        _raise_duplicate(existing, contas_ids)

    cliente_link = None
    cli_result = await db.execute(
        select(Cliente).where(Cliente.cnpj_cpf == parsed.dest_cnpj_cpf)
    )
    cli = cli_result.scalar_one_or_none()
    if cli:
        cliente_link = FornecedorVinculado(id=cli.id, nome=cli.nome)

    nome_dest = parsed.dest_nome or "Cliente"
    sugestoes = PreviewSugestoesReceber(
        descricao=f"NF-e nº {parsed.numero_nota} - {nome_dest}",
        observacoes=_format_observacoes(parsed),
    )

    return PreviewNFeReceberResponse(
        parsed=parsed,
        cliente=cliente_link,
        sugestoes=sugestoes,
    )


# ============= import =============

async def import_nfe_pagar(
    db: AsyncSession, payload: ImportNFePagarRequest, user: Usuario
) -> ImportNFePagarResponse:
    existing = await _find_existing_nota(db, payload.chave_acesso)
    if existing:
        contas_ids = await _find_contas_pagar_by_grupo(db, existing.grupo_parcelas_id)
        _raise_duplicate(existing, contas_ids)

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
        direcao="pagar",
        grupo_parcelas_id=grupo_id,
        created_by_user_id=user.id,
    )
    db.add(nota)

    await db.flush()

    return ImportNFePagarResponse(
        contas_pagar_ids=[c.id for c in contas],
        fornecedor_id=fornecedor.id,
        nota_fiscal_id=nota.id,
    )


async def import_nfe_receber(
    db: AsyncSession, payload: ImportNFeReceberRequest, user: Usuario
) -> ImportNFeReceberResponse:
    existing = await _find_existing_nota(db, payload.chave_acesso)
    if existing:
        contas_ids = await _find_contas_receber_by_grupo(db, existing.grupo_parcelas_id)
        _raise_duplicate(existing, contas_ids)

    if payload.cliente.id:
        cli_result = await db.execute(
            select(Cliente).where(Cliente.id == payload.cliente.id)
        )
        cliente = cli_result.scalar_one_or_none()
        if not cliente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente não encontrado",
            )
    else:
        cliente = Cliente(
            id=uuid.uuid4(),
            nome=payload.cliente.nome,
            cnpj_cpf=payload.cliente.cnpj_cpf,
            email=payload.cliente.email,
        )
        db.add(cliente)
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

    contas: List[ContaReceber] = []
    for i, parcela in enumerate(payload.parcelas):
        descricao = payload.descricao
        if n > 1:
            descricao = f"{payload.descricao} ({i + 1}/{n})"
        conta = ContaReceber(
            id=uuid.uuid4(),
            descricao=descricao,
            cliente_id=cliente.id,
            valor=float(parcela.valor),
            data_emissao=payload.data_emissao,
            data_vencimento=parcela.vencimento,
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
        cnpj_emitente=settings.EMPRESA_CNPJ,
        nome_emitente=payload.cliente.nome,
        valor_total=sum(float(p.valor) for p in payload.parcelas),
        data_emissao=payload.data_emissao,
        direcao="receber",
        grupo_parcelas_id=grupo_id,
        created_by_user_id=user.id,
    )
    db.add(nota)

    await db.flush()

    return ImportNFeReceberResponse(
        contas_receber_ids=[c.id for c in contas],
        cliente_id=cliente.id,
        nota_fiscal_id=nota.id,
    )
