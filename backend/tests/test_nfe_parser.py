from decimal import Decimal
from datetime import date
from pathlib import Path

import pytest

from app.services.nfe_parser import parse_nfe_xml, NFeParserError


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "nfe"


def load_fixture(name: str) -> bytes:
    return (FIXTURES_DIR / name).read_bytes()


def test_parse_real_nfe_pwm_1_parcela():
    xml = load_fixture("nfe_55_1_parcela_real.xml")

    result = parse_nfe_xml(xml)

    assert result.chave_acesso == "42260417888968000107550010000154731674299207"
    assert result.numero_nota == "15473"
    assert result.serie == "1"
    assert result.modelo == "55"
    assert result.data_emissao == date(2026, 4, 27)
    assert result.valor_total == Decimal("150.00")
    assert result.emitente_cnpj == "17888968000107"
    assert result.emitente_nome == "PWM REGUAS DIGITAIS LTDA"
    assert result.emitente_fantasia == "PWM REGUAS DIGITAIS"
    assert len(result.parcelas) == 1
    assert result.parcelas[0].numero == "001"
    assert result.parcelas[0].vencimento == date(2026, 5, 18)
    assert result.parcelas[0].valor == Decimal("150.00")
    assert len(result.itens) == 1
    assert "MOLA DE RETORNO" in result.itens[0].descricao
    assert result.itens[0].valor_total == Decimal("150.00")


def test_parse_3_parcelas():
    xml = load_fixture("nfe_55_3_parcelas.xml")

    result = parse_nfe_xml(xml)

    assert result.numero_nota == "999"
    assert result.emitente_cnpj == "11222333000144"
    assert result.valor_total == Decimal("300.00")
    assert len(result.parcelas) == 3
    assert [p.numero for p in result.parcelas] == ["001", "002", "003"]
    assert [p.vencimento for p in result.parcelas] == [
        date(2026, 5, 1), date(2026, 6, 1), date(2026, 7, 1)
    ]
    assert all(p.valor == Decimal("100.00") for p in result.parcelas)


def test_parse_sem_cobr_retorna_lista_vazia_de_parcelas():
    xml = load_fixture("nfe_55_sem_cobr.xml")

    result = parse_nfe_xml(xml)

    assert result.numero_nota == "1000"
    assert result.parcelas == []


def test_parse_nfe_cancelada_levanta_not_authorized():
    xml = load_fixture("nfe_55_cancelada.xml")

    with pytest.raises(NFeParserError) as exc_info:
        parse_nfe_xml(xml)

    assert exc_info.value.code == "NOT_AUTHORIZED"
    assert "101" in exc_info.value.message


def test_parse_nfc_e_modelo_65_levanta_unsupported_model():
    xml = load_fixture("nfc_e_modelo_65.xml")

    with pytest.raises(NFeParserError) as exc_info:
        parse_nfe_xml(xml)

    assert exc_info.value.code == "UNSUPPORTED_MODEL"


def test_parse_xml_malformado_levanta_invalid_xml():
    xml = load_fixture("xml_malformado.xml")

    with pytest.raises(NFeParserError) as exc_info:
        parse_nfe_xml(xml)

    assert exc_info.value.code == "INVALID_XML"


def test_parse_nao_nfe_levanta_not_nfe():
    xml = load_fixture("nao_nfe.xml")

    with pytest.raises(NFeParserError) as exc_info:
        parse_nfe_xml(xml)

    assert exc_info.value.code == "NOT_NFE"
