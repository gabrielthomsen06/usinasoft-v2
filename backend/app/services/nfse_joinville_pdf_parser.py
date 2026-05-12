from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import re

from app.schemas.nfe import NFeItemParsed, NFeParcelaParsed, NFeParsedData


class NFeParserError(Exception):
    """Reaproveita interface do parser XML."""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


# ============= _normalize_cnpj =============

def _normalize_cnpj(value: str) -> str:
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
    return date(ano, mes, dia)


# ============= _parse_valor_brl =============

_VALOR_LIQUIDO_RE = re.compile(
    r"Valor\s+líquido\s+da\s+NFS-e[^\d]*([\d.]+,\d{2})",
    re.IGNORECASE | re.DOTALL,
)
_VALOR_BRL_FALLBACK_RE = re.compile(
    r"VALOR\s+TOTAL\s+DO\s+SERVIÇO[^\d]*R?\$?\s*([\d.]+,\d{2})",
    re.IGNORECASE,
)


def _parse_valor_brl(text: str) -> Decimal:
    m = _VALOR_LIQUIDO_RE.search(text) or _VALOR_BRL_FALLBACK_RE.search(text)
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


def parse_nfse_joinville_pdf(pdf_bytes: bytes) -> NFeParsedData:
    raise NotImplementedError
