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


# ============= _parse_valor_brl =============

def test_parse_valor_brl_valor_liquido_nfse():
    texto = "Valor deduções\n0,00\nValor líquido da NFS-e\n10.776,00"
    assert _parse_valor_brl(texto) == Decimal("10776.00")


def test_parse_valor_brl_decimal_simples():
    texto = "Valor líquido da NFS-e 250,50"
    assert _parse_valor_brl(texto) == Decimal("250.50")


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
