import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import re

import pdfplumber

from app.schemas.nfe import NFeParcelaParsed, NFeParsedData


class NFeParserError(Exception):
    """Reaproveita interface do parser XML."""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


# ============= _normalize_cnpj =============

def _normalize_cnpj(value: Optional[str]) -> str:
    return re.sub(r"[^0-9]", "", value or "")


# ============= _parse_numero_serie =============

_NUMERO_SERIE_RE = re.compile(r"\b(\d{8,})\s*/\s*([A-Za-z0-9]+)\b")


def _parse_numero_serie(text: str) -> tuple[str, str]:
    m = _NUMERO_SERIE_RE.search(text)
    if not m:
        raise NFeParserError("MISSING_FIELDS", "Número/Série da nota não encontrado no PDF")
    numero = m.group(1).lstrip("0") or "0"
    serie = m.group(2)
    return numero, serie


# ============= _parse_data_emissao =============

_DATA_EMISSAO_RE = re.compile(
    r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?",
)


def _parse_data_emissao(text: str) -> date:
    # Procura datas dd/mm/yyyy; a primeira que aparece no PDF é a de emissão
    # (o cabeçalho "Data e Hora da Emissão" está no topo, antes de qualquer outra data).
    m = _DATA_EMISSAO_RE.search(text)
    if not m:
        raise NFeParserError("MISSING_FIELDS", "Data de emissão não encontrada no PDF")
    dia, mes, ano = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return date(ano, mes, dia)
    except ValueError as e:
        raise NFeParserError("MISSING_FIELDS", "Data de emissão inválida no PDF") from e


# ============= _parse_valor_brl =============

# Joinville PDFs concatenate all text without spaces, so both spaced and
# concatenated variants are needed.
_VALOR_TOTAL_CONCAT_RE = re.compile(
    r"VALORTOTALDOSERVI.O:R\$([\d.]+,\d{2})",
    re.IGNORECASE,
)
_VALOR_LIQUIDO_RE = re.compile(
    r"Valor\s+l.quido\s+da\s+NFS-e[^\d]*([\d.]+,\d{2})",
    re.IGNORECASE | re.DOTALL,
)
_VALOR_BRL_FALLBACK_RE = re.compile(
    r"VALOR\s+TOTAL\s+DO\s+SERVI.O[^\d]*R?\$?\s*([\d.]+,\d{2})",
    re.IGNORECASE,
)


def _parse_valor_brl(text: str) -> Decimal:
    # Try concatenated form first (Joinville PDFs), then spaced variants
    m = (
        _VALOR_TOTAL_CONCAT_RE.search(text)
        or _VALOR_LIQUIDO_RE.search(text)
        or _VALOR_BRL_FALLBACK_RE.search(text)
    )
    if not m:
        raise NFeParserError("MISSING_FIELDS", "Valor da nota não encontrado no PDF")
    raw = m.group(1).replace(".", "").replace(",", ".")
    return Decimal(raw)


# ============= _parse_vencimentos =============

_VENC_MULTI_RE = re.compile(
    r"vencimentos?\s*:?\s*((?:\d{1,2}/\d{1,2}(?:/\d{2,4})?(?:\s*[,;/]\s*|\s+)){1,}\d{1,2}/\d{1,2}(?:/\d{2,4})?)",
    re.IGNORECASE,
)
_VENC_SINGLE_RE = re.compile(
    r"venc(?:imento)?\s*(?:dia)?\s*:?\s*(\d{1,2}/\d{1,2}/\d{2,4})",
    re.IGNORECASE,
)
_DATE_TOKEN_RE = re.compile(r"\d{1,2}/\d{1,2}(?:/\d{2,4})?")


def _expand_year(y: int) -> int:
    return 2000 + y if y < 100 else y


def _parse_date_token(token: str, fallback_year: Optional[int] = None) -> Optional[date]:
    parts = token.split("/")
    if len(parts) == 2:
        if fallback_year is None:
            return None
        d, m = int(parts[0]), int(parts[1])
        y = fallback_year
    elif len(parts) == 3:
        d, m, y = int(parts[0]), int(parts[1]), _expand_year(int(parts[2]))
    else:
        return None
    try:
        return date(y, m, d)
    except ValueError:
        return None


def _split_valor_em_parcelas(total: Decimal, n: int) -> list[Decimal]:
    # Divide igualmente em 2 casas, jogando o resto na última parcela
    quant = (total / n).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    parcelas = [quant] * (n - 1)
    parcelas.append(total - sum(parcelas))
    return parcelas


def _parse_vencimentos(text: str, valor_total: Decimal) -> list[NFeParcelaParsed]:
    multi = _VENC_MULTI_RE.search(text)
    datas: list[date] = []
    if multi:
        tokens = _DATE_TOKEN_RE.findall(multi.group(1))
        # se primeira tem ano e demais não, usar esse ano como fallback
        fallback_year: Optional[int] = None
        for tok in tokens:
            if tok.count("/") == 2:
                _, _, y_raw = tok.split("/")
                fallback_year = _expand_year(int(y_raw))
                break
        for tok in tokens:
            d = _parse_date_token(tok, fallback_year=fallback_year)
            if d:
                datas.append(d)

    if not datas:
        single = _VENC_SINGLE_RE.search(text)
        if single:
            d = _parse_date_token(single.group(1))
            if d:
                datas.append(d)

    if not datas:
        return []

    valores = _split_valor_em_parcelas(valor_total, len(datas))
    return [
        NFeParcelaParsed(numero=f"{i+1:03d}", vencimento=datas[i], valor=valores[i])
        for i in range(len(datas))
    ]


# ============= PDF extraction =============

# Layout signature present in all Joinville NFS-e PDFs
_JOINVILLE_SIGNATURE = "NF-em"


@dataclass
class _PdfSections:
    full_text: str          # texto completo da primeira página
    prestador_text: str     # bloco entre PRESTADOR e TOMADOR
    tomador_text: str       # bloco entre TOMADOR e DISCRIMINAÇÃO
    discriminacao_text: str  # bloco entre DISCRIMINAÇÃO e VALOR TOTAL


def _find_label_y(page, label: str) -> Optional[float]:
    """Retorna a coordenada 'top' da primeira palavra cujo texto contém o label, ou None."""
    label_lower = label.lower()
    for w in page.extract_words():
        if label_lower in w["text"].lower():
            return w["top"]
    return None


def _extract_pdf_sections(pdf_bytes: bytes) -> _PdfSections:
    try:
        pdf = pdfplumber.open(io.BytesIO(pdf_bytes))
    except Exception as e:
        raise NFeParserError("INVALID_PDF", "Não foi possível ler o PDF") from e

    try:
        if not pdf.pages:
            raise NFeParserError("INVALID_PDF", "PDF sem páginas")

        page = pdf.pages[0]
        full_text = page.extract_text() or ""

        if _JOINVILLE_SIGNATURE not in full_text:
            raise NFeParserError(
                "NOT_NFSE_JOINVILLE",
                "Este PDF não parece ser uma NFS-e da Prefeitura de Joinville",
            )

        # Encontra âncoras verticais para separar os blocos PRESTADOR / TOMADOR /
        # DISCRIMINAÇÃO. Os headers são palavras concatenadas sem espaço.
        y_prestador = _find_label_y(page, "PRESTADORDESERVI")
        y_tomador = _find_label_y(page, "TOMADORDESERVI")
        y_discriminacao = _find_label_y(page, "DISCRIMINA")
        y_valor_total = _find_label_y(page, "VALORTOTALDOSERVI")

        w = page.width

        def _crop_text(top: float, bottom: float) -> str:
            if top is None or bottom is None or bottom <= top:
                return ""
            crop = page.within_bbox((0, top, w, bottom))
            return crop.extract_text() or ""

        prestador_text = _crop_text(
            y_prestador + 5 if y_prestador is not None else 0,
            y_tomador - 2 if y_tomador is not None else page.height,
        )
        tomador_text = _crop_text(
            y_tomador + 5 if y_tomador is not None else 0,
            y_discriminacao - 2 if y_discriminacao is not None else page.height,
        )
        discriminacao_text = _crop_text(
            y_discriminacao + 2 if y_discriminacao is not None else 0,
            y_valor_total + 20 if y_valor_total is not None else page.height,
        )

        return _PdfSections(
            full_text=full_text,
            prestador_text=prestador_text,
            tomador_text=tomador_text,
            discriminacao_text=discriminacao_text,
        )
    finally:
        pdf.close()


# Labels used in Joinville PDFs are concatenated (no spaces between words)
_LABEL_RE_CACHE: dict[str, re.Pattern] = {}


def _extract_label(text: str, label: str) -> Optional[str]:
    """Extrai o valor após um label (com ou sem espaços internos) no texto.

    Tenta a forma concatenada e a forma com espaços, retornando o primeiro match.
    """
    # Try the label as-is first, then without spaces (concatenated form)
    variants = [label, label.replace(" ", "")]
    for variant in variants:
        pattern = _LABEL_RE_CACHE.get(variant)
        if pattern is None:
            pattern = re.compile(
                rf"{re.escape(variant)}\s*:?\s*([^\n]*?)(?=\n|$)",
                re.IGNORECASE,
            )
            _LABEL_RE_CACHE[variant] = pattern
        m = pattern.search(text)
        if m:
            value = m.group(1).strip()
            if value:
                return value
    return None


def _extract_cnpj_from_block(text: str) -> Optional[str]:
    """Extrai o CNPJ/CPF do campo CPF/CNPJ: no bloco de texto."""
    m = re.search(r"CPF/CNPJ:\s*(\S+)", text, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return None


def _extract_nome_from_block(text: str, prefer_empresarial: bool = True) -> Optional[str]:
    """Extrai o nome empresarial ou fantasia do bloco de texto."""
    # Labels aparecem na forma concatenada no PDF de Joinville
    labels = (
        ["Nomeempresarial", "Nome empresarial", "Nomefantasia", "Nome fantasia", "Nome"]
        if prefer_empresarial
        else ["Nome fantasia", "Nomefantasia", "Nomeempresarial", "Nome empresarial", "Nome"]
    )
    for label in labels:
        m = re.search(rf"{re.escape(label)}:\s*(.+)", text, re.IGNORECASE)
        if m:
            value = m.group(1).strip()
            if value:
                return value
    return None


def parse_nfse_joinville_pdf(pdf_bytes: bytes) -> NFeParsedData:
    sections = _extract_pdf_sections(pdf_bytes)

    # Número/série vem do cabeçalho, ex: "00000000162/A1"
    numero, serie = _parse_numero_serie(sections.full_text)

    # Data de emissão: primeira data dd/mm/yyyy no texto
    data_emissao = _parse_data_emissao(sections.full_text)

    # Valor total: usa o campo "VALORTOTALDOSERVI?O:R$..." do PDF concatenado
    valor_total = _parse_valor_brl(sections.full_text)

    # Chave nacional NFS-e (50 dígitos) — sem word boundary pois está em linha contínua
    chave_m = re.search(r"(\d{50})", sections.full_text)
    if not chave_m:
        raise NFeParserError("MISSING_FIELDS", "Chave de acesso (50 dígitos) não encontrada no PDF")
    chave = chave_m.group(1)

    # PRESTADOR (emitente)
    emit_cnpj_raw = _extract_cnpj_from_block(sections.prestador_text)
    if not emit_cnpj_raw:
        raise NFeParserError("MISSING_FIELDS", "CNPJ do prestador não encontrado no PDF")
    emit_cnpj = _normalize_cnpj(emit_cnpj_raw.split()[0])
    if len(emit_cnpj) not in (11, 14):
        raise NFeParserError("MISSING_FIELDS", "CNPJ/CPF do prestador inválido")

    emit_nome = _extract_nome_from_block(sections.prestador_text, prefer_empresarial=True) or ""
    emit_fantasia = _extract_label(sections.prestador_text, "Nomefantasia") or _extract_label(
        sections.prestador_text, "Nome fantasia"
    )

    # TOMADOR (destinatário)
    dest_cnpj_raw = _extract_cnpj_from_block(sections.tomador_text)
    dest_cnpj = _normalize_cnpj(dest_cnpj_raw.split()[0]) if dest_cnpj_raw else None
    if dest_cnpj and len(dest_cnpj) not in (11, 14):
        dest_cnpj = None
    dest_nome = _extract_nome_from_block(sections.tomador_text, prefer_empresarial=False)

    # Parcelas — texto livre da discriminação
    parcelas = _parse_vencimentos(sections.discriminacao_text, valor_total)

    return NFeParsedData(
        chave_acesso=chave,
        numero_nota=numero,
        serie=serie,
        modelo="NFSE",
        data_emissao=data_emissao,
        valor_total=valor_total,
        emitente_cnpj=emit_cnpj,
        emitente_nome=emit_nome,
        emitente_fantasia=emit_fantasia,
        emitente_email=None,
        dest_cnpj_cpf=dest_cnpj,
        dest_nome=dest_nome,
        dest_email=None,
        parcelas=parcelas,
        itens=[],
    )
