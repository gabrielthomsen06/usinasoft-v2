from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.conta_pagar import ContaPagar
from app.models.fornecedor import Fornecedor
from app.models.nota_fiscal import NotaFiscal


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "nfe"


def fixture_path(name: str) -> Path:
    return FIXTURES_DIR / name


# ============= preview-nfe =============

async def test_preview_nfe_real_xml_retorna_dados(client: AsyncClient):
    xml_bytes = fixture_path("nfe_55_1_parcela_real.xml").read_bytes()

    response = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("nfe.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["parsed"]["chave_acesso"] == "42260417888968000107550010000154731674299207"
    assert data["parsed"]["emitente_cnpj"] == "17888968000107"
    assert data["fornecedor"] is None
    assert data["sugestoes"]["descricao"].startswith("NF-e nº 15473")
    assert data["sugestoes"]["categoria"] == "material"


async def test_preview_nfe_vincula_fornecedor_existente(
    client: AsyncClient, db_session: AsyncSession
):
    forn = Fornecedor(
        nome="PWM JÁ CADASTRADO",
        cnpj_cpf="17888968000107",
    )
    db_session.add(forn)
    await db_session.commit()

    xml_bytes = fixture_path("nfe_55_1_parcela_real.xml").read_bytes()

    response = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("nfe.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["fornecedor"] is not None
    assert data["fornecedor"]["nome"] == "PWM JÁ CADASTRADO"
    assert data["fornecedor"]["id"] == str(forn.id)


async def test_preview_nfe_xml_malformado_retorna_400(client: AsyncClient):
    xml_bytes = fixture_path("xml_malformado.xml").read_bytes()

    response = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("nfe.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "INVALID_XML"


async def test_preview_nfe_modelo_65_retorna_400_unsupported(client: AsyncClient):
    xml_bytes = fixture_path("nfc_e_modelo_65.xml").read_bytes()

    response = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("nfce.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "UNSUPPORTED_MODEL"


async def test_preview_nfe_cancelada_retorna_400_not_authorized(client: AsyncClient):
    xml_bytes = fixture_path("nfe_55_cancelada.xml").read_bytes()

    response = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("c.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "NOT_AUTHORIZED"


async def test_preview_nfe_arquivo_muito_grande_retorna_413(client: AsyncClient):
    big = b"<?xml version='1.0'?><x>" + b"a" * (1024 * 1024 + 100) + b"</x>"

    response = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("big.xml", big, "application/xml")},
    )

    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "FILE_TOO_LARGE"


# ============= import-nfe =============

async def test_import_nfe_cria_fornecedor_novo_e_3_contas(
    client: AsyncClient, db_session: AsyncSession
):
    payload = {
        "chave_acesso": "11111111111111111111111111111111111111111111",
        "fornecedor": {
            "id": None,
            "nome": "FORNECEDOR TESTE LTDA",
            "cnpj": "11222333000144",
            "email": None,
        },
        "descricao": "NF-e nº 999 - FORNEC TESTE",
        "categoria": "material",
        "observacoes": "Itens: parafusos",
        "data_emissao": "2026-04-01",
        "parcelas": [
            {"vencimento": "2026-05-01", "valor": "100.00"},
            {"vencimento": "2026-06-01", "valor": "100.00"},
            {"vencimento": "2026-07-01", "valor": "100.00"},
        ],
    }

    response = await client.post("/api/contas-pagar/import-nfe", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert len(data["contas_pagar_ids"]) == 3
    assert data["fornecedor_id"] is not None
    assert data["nota_fiscal_id"] is not None

    forn_q = await db_session.execute(
        select(Fornecedor).where(Fornecedor.cnpj_cpf == "11222333000144")
    )
    fornecedor = forn_q.scalar_one()
    assert fornecedor.nome == "FORNECEDOR TESTE LTDA"

    contas_q = await db_session.execute(
        select(ContaPagar).where(ContaPagar.fornecedor_id == fornecedor.id)
        .order_by(ContaPagar.parcela_atual)
    )
    contas = list(contas_q.scalars().all())
    assert len(contas) == 3
    assert contas[0].parcela_atual == 1
    assert contas[0].total_parcelas == 3
    assert contas[1].parcela_atual == 2
    assert contas[2].parcela_atual == 3
    grupos = {c.grupo_parcelas_id for c in contas}
    assert len(grupos) == 1
    assert all(c.intervalo_dias == 31 for c in contas)

    nota_q = await db_session.execute(
        select(NotaFiscal).where(
            NotaFiscal.chave_acesso == "11111111111111111111111111111111111111111111"
        )
    )
    nota = nota_q.scalar_one()
    assert nota.grupo_parcelas_id == contas[0].grupo_parcelas_id


async def test_import_nfe_usa_fornecedor_existente(
    client: AsyncClient, db_session: AsyncSession
):
    forn = Fornecedor(
        nome="JA EXISTE",
        cnpj_cpf="11222333000144",
    )
    db_session.add(forn)
    await db_session.commit()

    payload = {
        "chave_acesso": "55555555555555555555555555555555555555555555",
        "fornecedor": {
            "id": str(forn.id),
            "nome": "JA EXISTE",
            "cnpj": "11222333000144",
        },
        "descricao": "NF-e teste",
        "categoria": "material",
        "data_emissao": "2026-04-01",
        "parcelas": [
            {"vencimento": "2026-05-01", "valor": "50.00"},
        ],
    }

    response = await client.post("/api/contas-pagar/import-nfe", json=payload)

    assert response.status_code == 201
    assert response.json()["fornecedor_id"] == str(forn.id)

    fornecedores_q = await db_session.execute(
        select(Fornecedor).where(Fornecedor.cnpj_cpf == "11222333000144")
    )
    assert len(list(fornecedores_q.scalars().all())) == 1


async def test_import_nfe_duplicada_retorna_409(
    client: AsyncClient, db_session: AsyncSession
):
    payload = {
        "chave_acesso": "99999999999999999999999999999999999999999999",
        "fornecedor": {"id": None, "nome": "X", "cnpj": "11222333000144"},
        "descricao": "NF-e teste",
        "categoria": "material",
        "data_emissao": "2026-04-01",
        "parcelas": [{"vencimento": "2026-05-01", "valor": "10.00"}],
    }

    r1 = await client.post("/api/contas-pagar/import-nfe", json=payload)
    assert r1.status_code == 201

    r2 = await client.post("/api/contas-pagar/import-nfe", json=payload)
    assert r2.status_code == 409
    detail = r2.json()["detail"]
    assert detail["code"] == "DUPLICATE"
    assert detail["chave_acesso"] == "99999999999999999999999999999999999999999999"
    assert len(detail["contas_pagar_ids"]) == 1


async def test_preview_nfe_duplicada_retorna_409(
    client: AsyncClient, db_session: AsyncSession
):
    payload = {
        "chave_acesso": "42260417888968000107550010000154731674299207",
        "fornecedor": {"id": None, "nome": "PWM", "cnpj": "17888968000107"},
        "descricao": "NF-e",
        "categoria": "material",
        "data_emissao": "2026-04-27",
        "parcelas": [{"vencimento": "2026-05-18", "valor": "150.00"}],
    }
    r1 = await client.post("/api/contas-pagar/import-nfe", json=payload)
    assert r1.status_code == 201

    xml_bytes = fixture_path("nfe_55_1_parcela_real.xml").read_bytes()
    r2 = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("nfe.xml", xml_bytes, "application/xml")},
    )
    assert r2.status_code == 409
    assert r2.json()["detail"]["code"] == "DUPLICATE"
