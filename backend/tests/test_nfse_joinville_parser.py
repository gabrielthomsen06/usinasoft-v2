from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.services.nfse_joinville_pdf_parser import (
    _normalize_cnpj,
    _parse_data_emissao,
    _parse_numero_serie,
    _parse_valor_brl,
    _parse_vencimentos,
    NFeParserError,
)


# ============= _normalize_cnpj =============

def test_normalize_cnpj_remove_pontuacao():
    assert _normalize_cnpj("53.428.953/0001-11") == "53428953000111"


def test_normalize_cnpj_ja_sem_pontuacao():
    assert _normalize_cnpj("53428953000111") == "53428953000111"


def test_normalize_cnpj_com_espacos():
    assert _normalize_cnpj("  53.428.953/0001-11  ") == "53428953000111"


def test_normalize_cnpj_none_retorna_string_vazia():
    assert _normalize_cnpj(None) == ""


# ============= _parse_numero_serie =============

def test_parse_numero_serie_padrao_joinville():
    texto = "Número / Série\n00000000162 / A1\nData e Hora..."
    numero, serie = _parse_numero_serie(texto)
    assert numero == "162"  # zeros à esquerda removidos
    assert serie == "A1"


def test_parse_numero_serie_nao_encontrado():
    with pytest.raises(NFeParserError) as exc:
        _parse_numero_serie("texto qualquer sem numero")
    assert exc.value.code == "MISSING_FIELDS"


# ============= _parse_data_emissao =============

def test_parse_data_emissao_formato_completo():
    texto = "Data e Hora da Emissão\n12/05/2026 14:36:34"
    assert _parse_data_emissao(texto) == date(2026, 5, 12)


def test_parse_data_emissao_so_data():
    texto = "Data de Emissão: 12/05/2026"
    assert _parse_data_emissao(texto) == date(2026, 5, 12)


def test_parse_data_emissao_nao_encontrada():
    with pytest.raises(NFeParserError) as exc:
        _parse_data_emissao("sem data nenhuma")
    assert exc.value.code == "MISSING_FIELDS"


def test_parse_data_emissao_data_invalida():
    """Data com dia/mês fora do range válido raises NFeParserError (não ValueError)."""
    with pytest.raises(NFeParserError) as exc:
        _parse_data_emissao("Data de Emissão: 31/02/2026")
    assert exc.value.code == "MISSING_FIELDS"


# ============= _parse_valor_brl =============

def test_parse_valor_brl_valor_liquido_nfse():
    texto = "Valor deduções\n0,00\nValor líquido da NFS-e\n10.776,00"
    assert _parse_valor_brl(texto) == Decimal("10776.00")


def test_parse_valor_brl_decimal_simples():
    texto = "Valor líquido da NFS-e 250,50"
    assert _parse_valor_brl(texto) == Decimal("250.50")


def test_parse_valor_brl_valor_total_servico():
    """O parser deve aceitar 'VALOR TOTAL DO SERVIÇO' como fonte primária."""
    texto = "VALOR TOTAL DO SERVIÇO: R$ 10.776,00"
    assert _parse_valor_brl(texto) == Decimal("10776.00")


def test_parse_valor_brl_nao_encontrado():
    with pytest.raises(NFeParserError) as exc:
        _parse_valor_brl("texto sem valor")
    assert exc.value.code == "MISSING_FIELDS"


# ============= _parse_vencimentos =============

def test_parse_vencimentos_unica_data():
    texto = "serviços prestados\nref pedido de compra n 120921\nvencimento dia 02/06/26"
    valor = Decimal("10776.00")
    parcelas = _parse_vencimentos(texto, valor)
    assert len(parcelas) == 1
    assert parcelas[0].numero == "001"
    assert parcelas[0].vencimento == date(2026, 6, 2)
    assert parcelas[0].valor == Decimal("10776.00")


def test_parse_vencimentos_data_ano_4_digitos():
    texto = "vencimento 15/07/2026"
    parcelas = _parse_vencimentos(texto, Decimal("500.00"))
    assert len(parcelas) == 1
    assert parcelas[0].vencimento == date(2026, 7, 15)


def test_parse_vencimentos_multiplas_datas_virgula():
    texto = "vencimentos: 02/06/26, 02/07/26, 02/08/26"
    valor = Decimal("900.00")
    parcelas = _parse_vencimentos(texto, valor)
    assert len(parcelas) == 3
    assert [p.vencimento for p in parcelas] == [
        date(2026, 6, 2), date(2026, 7, 2), date(2026, 8, 2),
    ]
    assert [p.numero for p in parcelas] == ["001", "002", "003"]
    # divisão em 3 partes iguais
    assert sum(p.valor for p in parcelas) == Decimal("900.00")
    assert parcelas[0].valor == Decimal("300.00")


def test_parse_vencimentos_divisao_com_resto():
    texto = "vencimentos: 01/06/26, 01/07/26, 01/08/26"
    valor = Decimal("100.00")  # 100/3 = 33.33... resto vai pra última
    parcelas = _parse_vencimentos(texto, valor)
    assert sum(p.valor for p in parcelas) == Decimal("100.00")
    assert parcelas[0].valor == Decimal("33.33")
    assert parcelas[1].valor == Decimal("33.33")
    assert parcelas[2].valor == Decimal("33.34")


def test_parse_vencimentos_sem_data():
    parcelas = _parse_vencimentos("texto sem nenhuma menção a vencimento", Decimal("100"))
    assert parcelas == []


def test_parse_vencimentos_ignora_outras_datas_no_texto():
    """Datas que não estejam após 'vencimento' não viram parcelas."""
    texto = "ref nota emitida em 12/05/2026, pedido de 01/01/2025"
    parcelas = _parse_vencimentos(texto, Decimal("100"))
    assert parcelas == []


def test_parse_vencimentos_data_unica_com_dois_pontos():
    texto = "vencimento: 02/06/2026"
    parcelas = _parse_vencimentos(texto, Decimal("500.00"))
    assert len(parcelas) == 1
    assert parcelas[0].vencimento == date(2026, 6, 2)


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "nfse"


def load_pdf(name: str) -> bytes:
    return (FIXTURES_DIR / name).read_bytes()


# ============= parse_nfse_joinville_pdf — integração =============

def test_parse_pdf_real_162():
    from app.services.nfse_joinville_pdf_parser import parse_nfse_joinville_pdf

    pdf = load_pdf("nfse_joinville_162.pdf")
    result = parse_nfse_joinville_pdf(pdf)

    assert result.modelo == "NFSE"
    assert result.numero_nota == "162"
    assert result.serie == "A1"
    assert result.data_emissao == date(2026, 5, 12)
    assert result.valor_total == Decimal("10776.00")

    # Prestador = LSC USINAGEM (empresa)
    assert result.emitente_cnpj == "53428953000111"
    assert "LSC USINAGEM" in result.emitente_nome.upper()

    # Tomador = VÍQUA (cliente)
    assert result.dest_cnpj_cpf == "00477761000139"
    assert "VÍQUA" in result.dest_nome.upper() or "VIQUA" in result.dest_nome.upper()

    # Chave nacional NFS-e tem 50 dígitos
    assert len(result.chave_acesso) == 50
    assert result.chave_acesso.isdigit()

    # Vencimento extraído do texto livre "vencimento dia 02/06/26"
    assert len(result.parcelas) == 1
    assert result.parcelas[0].vencimento == date(2026, 6, 2)
    assert result.parcelas[0].valor == Decimal("10776.00")

    # NFS-e Joinville não tem itens estruturados
    assert result.itens == []


def test_parse_pdf_invalido():
    from app.services.nfse_joinville_pdf_parser import parse_nfse_joinville_pdf

    with pytest.raises(NFeParserError) as exc:
        parse_nfse_joinville_pdf(b"not a pdf at all")
    assert exc.value.code == "INVALID_PDF"


def test_parse_pdf_nao_e_nfse_joinville():
    """PDF válido mas que não contém a assinatura do layout Joinville."""
    from app.services.nfse_joinville_pdf_parser import parse_nfse_joinville_pdf

    # PDF minimal de 1 página com texto "Hello World"
    minimal_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>endobj\n"
        b"4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 100 700 Td (Hello World) Tj ET\nendstream\nendobj\n"
        b"xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000100 00000 n \n0000000179 00000 n \n"
        b"trailer<</Size 5/Root 1 0 R>>\nstartxref\n270\n%%EOF"
    )

    with pytest.raises(NFeParserError) as exc:
        parse_nfse_joinville_pdf(minimal_pdf)
    # Pode falhar como INVALID_PDF (se pymupdf rejeitar) ou NOT_NFSE_JOINVILLE
    assert exc.value.code in ("INVALID_PDF", "NOT_NFSE_JOINVILLE")
