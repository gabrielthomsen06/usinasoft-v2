"""Parser for Joinville NFS-e PDFs (Prefeitura de Joinville, SC).

Uses PyMuPDF word-bbox extraction to split the page into vertical sections
anchored by section headers (PRESTADOR → TOMADOR → DISCRIMINAÇÃO → VALOR TOTAL).
Column splitting was considered but not needed: sections are stacked vertically
in the real PDF, not side by side.
"""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import re

import fitz  # PyMuPDF

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

_VALOR_LIQUIDO_RE = re.compile(
    r"Valor\s+l.quido\s+da\s+NFS-e[^\d]*([\d.]+,\d{2})",
    re.IGNORECASE | re.DOTALL,
)
_VALOR_TOTAL_RE = re.compile(
    r"VALOR\s+TOTAL\s+DO\s+SERVI.O[^\d]*R?\$?\s*([\d.]+,\d{2})",
    re.IGNORECASE,
)


def _parse_valor_brl(text: str) -> Decimal:
    # Try "VALOR TOTAL DO SERVIÇO" first (more specific), then "Valor líquido da NFS-e"
    m = _VALOR_TOTAL_RE.search(text) or _VALOR_LIQUIDO_RE.search(text)
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


def _words_to_lines(words: list) -> dict[float, str]:
    """Agrupa palavras por linha (y arredondado) e retorna dict y -> texto da linha.

    Usa bucket de 4pt para tolerar pequenas diferenças de baseline entre label e valor
    na mesma linha visual (common in Joinville NFS-e PDFs).
    """
    groups: dict[float, list[tuple[float, str]]] = {}
    for w in words:
        x0, y0, x1, y1, text = w[0], w[1], w[2], w[3], w[4]
        # round y to nearest 4pt bucket to merge same-line words
        y_key = round(y0 / 4) * 4
        groups.setdefault(y_key, []).append((x0, text))
    result = {}
    for y_key, items in groups.items():
        items.sort(key=lambda t: t[0])
        result[y_key] = " ".join(t[1] for t in items)
    return result


def _extract_pdf_sections(pdf_bytes: bytes) -> _PdfSections:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise NFeParserError("INVALID_PDF", "Não foi possível ler o PDF") from e

    with doc:
        if not doc.page_count:
            raise NFeParserError("INVALID_PDF", "PDF sem páginas")

        page = doc[0]
        full_text = page.get_text()

        if _JOINVILLE_SIGNATURE not in full_text:
            raise NFeParserError(
                "NOT_NFSE_JOINVILLE",
                "Este PDF não parece ser uma NFS-e da Prefeitura de Joinville",
            )

        words = page.get_text("words")
        lines = _words_to_lines(words)
        sorted_ys = sorted(lines.keys())

        # Find y-anchors for each section header
        y_prestador: Optional[float] = None
        y_tomador: Optional[float] = None
        y_discriminacao: Optional[float] = None
        y_valor_total: Optional[float] = None

        for y in sorted_ys:
            line_upper = lines[y].upper()
            if y_prestador is None and "PRESTADOR" in line_upper and "SERVI" in line_upper:
                y_prestador = y
            elif y_tomador is None and "TOMADOR" in line_upper and "SERVI" in line_upper:
                y_tomador = y
            elif y_discriminacao is None and "DISCRIMINA" in line_upper:
                y_discriminacao = y
            elif y_valor_total is None and "VALOR TOTAL" in line_upper and "SERVI" in line_upper:
                y_valor_total = y

        def _section_text(y_start: Optional[float], y_end: Optional[float]) -> str:
            if y_start is None:
                return ""
            lines_in_range = [
                lines[y] for y in sorted_ys
                if y > y_start and (y_end is None or y < y_end)
            ]
            return "\n".join(lines_in_range)

        prestador_text = _section_text(y_prestador, y_tomador)
        tomador_text = _section_text(y_tomador, y_discriminacao)
        discriminacao_text = _section_text(y_discriminacao, y_valor_total)

        return _PdfSections(
            full_text=full_text,
            prestador_text=prestador_text,
            tomador_text=tomador_text,
            discriminacao_text=discriminacao_text,
        )


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


def parse_nfse_joinville_pdf(pdf_bytes: bytes) -> NFeParsedData:
    sections = _extract_pdf_sections(pdf_bytes)

    # Número/série vem do cabeçalho, ex: "00000000162 / A1"
    numero, serie = _parse_numero_serie(sections.full_text)

    # Data de emissão: primeira data dd/mm/yyyy no texto
    data_emissao = _parse_data_emissao(sections.full_text)

    # Valor total
    valor_total = _parse_valor_brl(sections.full_text)

    # Chave nacional NFS-e (50 dígitos)
    chave_m = re.search(r"(\d{50})", sections.full_text)
    if not chave_m:
        raise NFeParserError("MISSING_FIELDS", "Chave de acesso (50 dígitos) não encontrada no PDF")
    chave = chave_m.group(1)

    # PRESTADOR (emitente)
    emit_cnpj_raw = _extract_label(sections.prestador_text, "CPF/CNPJ")
    if not emit_cnpj_raw:
        raise NFeParserError("MISSING_FIELDS", "CNPJ do prestador não encontrado no PDF")
    emit_cnpj = _normalize_cnpj(emit_cnpj_raw.split()[0])
    if len(emit_cnpj) not in (11, 14):
        raise NFeParserError("MISSING_FIELDS", "CNPJ/CPF do prestador inválido")

    emit_nome = _extract_label(sections.prestador_text, "Nome empresarial") or ""
    emit_fantasia = _extract_label(sections.prestador_text, "Nome fantasia")

    # TOMADOR (destinatário)
    dest_cnpj_raw = _extract_label(sections.tomador_text, "CPF/CNPJ")
    dest_cnpj = _normalize_cnpj(dest_cnpj_raw.split()[0]) if dest_cnpj_raw else None
    if dest_cnpj and len(dest_cnpj) not in (11, 14):
        dest_cnpj = None
    dest_nome = _extract_label(sections.tomador_text, "Nome fantasia") or _extract_label(
        sections.tomador_text, "Nome"
    )

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
