from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.cliente import Cliente
from app.models.conta_receber import ContaReceber
from app.models.nota_fiscal import NotaFiscal


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "nfe"


def fixture_path(name: str) -> Path:
    return FIXTURES_DIR / name


# ============= preview-nfe receber =============

async def test_preview_nfe_receber_xml_valido(client: AsyncClient):
    xml_bytes = fixture_path("nfe_55_receber_3_parcelas.xml").read_bytes()

    response = await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("nfe.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["parsed"]["chave_acesso"] == "77777777777777777777777777777777777777777777"
    assert data["parsed"]["emitente_cnpj"] == "53428953000111"
    assert data["parsed"]["dest_cnpj_cpf"] == "22333444000155"
    assert data["cliente"] is None
    assert data["sugestoes"]["descricao"].startswith("NF-e nº 2025")
    assert "categoria" not in data["sugestoes"]


async def test_preview_nfe_receber_vincula_cliente_existente(
    client: AsyncClient, db_session: AsyncSession
):
    cli = Cliente(
        nome="CLIENTE JÁ CADASTRADO",
        cnpj_cpf="22333444000155",
    )
    db_session.add(cli)
    await db_session.commit()

    xml_bytes = fixture_path("nfe_55_receber_3_parcelas.xml").read_bytes()
    response = await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("nfe.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["cliente"] is not None
    assert data["cliente"]["nome"] == "CLIENTE JÁ CADASTRADO"
    assert data["cliente"]["id"] == str(cli.id)


# ============= validação cruzada =============

async def test_preview_pagar_rejeita_xml_de_receber(client: AsyncClient):
    """XML emitido pela empresa não deve ser aceito em /contas-pagar/preview-nfe."""
    xml_bytes = fixture_path("nfe_55_receber_3_parcelas.xml").read_bytes()

    response = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("nfe.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["code"] == "WRONG_DIRECTION"
    assert "Receber" in detail["message"]


async def test_preview_receber_rejeita_xml_de_pagar(client: AsyncClient):
    """XML recebido (LSC como destinatário) não deve ser aceito em /contas-receber."""
    xml_bytes = fixture_path("nfe_55_3_parcelas.xml").read_bytes()

    response = await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("nfe.xml", xml_bytes, "application/xml")},
    )

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["code"] == "WRONG_DIRECTION"
    assert "Pagar" in detail["message"]


# ============= import receber =============

async def test_import_nfe_receber_cria_cliente_e_3_contas(
    client: AsyncClient, db_session: AsyncSession
):
    payload = {
        "chave_acesso": "77777777777777777777777777777777777777777777",
        "cliente": {
            "id": None,
            "nome": "CLIENTE INDUSTRIA LTDA",
            "cnpj_cpf": "22333444000155",
            "email": "compras@cliente.com.br",
        },
        "descricao": "NF-e nº 2025 - CLIENTE INDUSTRIA LTDA",
        "observacoes": "Usinagem de eixo",
        "data_emissao": "2026-04-20",
        "parcelas": [
            {"vencimento": "2026-05-20", "valor": "266.67"},
            {"vencimento": "2026-06-20", "valor": "266.67"},
            {"vencimento": "2026-07-20", "valor": "266.66"},
        ],
    }

    response = await client.post("/api/contas-receber/import-nfe", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert len(data["contas_receber_ids"]) == 3
    assert data["cliente_id"] is not None
    assert data["nota_fiscal_id"] is not None

    cli_q = await db_session.execute(
        select(Cliente).where(Cliente.cnpj_cpf == "22333444000155")
    )
    cliente = cli_q.scalar_one()
    assert cliente.nome == "CLIENTE INDUSTRIA LTDA"

    contas_q = await db_session.execute(
        select(ContaReceber).where(ContaReceber.cliente_id == cliente.id)
        .order_by(ContaReceber.parcela_atual)
    )
    contas = list(contas_q.scalars().all())
    assert len(contas) == 3
    assert contas[0].parcela_atual == 1
    assert contas[0].total_parcelas == 3
    grupos = {c.grupo_parcelas_id for c in contas}
    assert len(grupos) == 1
    assert all(c.intervalo_dias == 31 for c in contas)

    nota_q = await db_session.execute(
        select(NotaFiscal).where(
            NotaFiscal.chave_acesso == "77777777777777777777777777777777777777777777"
        )
    )
    nota = nota_q.scalar_one()
    assert nota.direcao == "receber"
    assert nota.grupo_parcelas_id == contas[0].grupo_parcelas_id


async def test_import_nfe_receber_usa_cliente_existente(
    client: AsyncClient, db_session: AsyncSession
):
    cli = Cliente(nome="JA CADASTRADO", cnpj_cpf="22333444000155")
    db_session.add(cli)
    await db_session.commit()

    payload = {
        "chave_acesso": "88888888888888888888888888888888888888888888",
        "cliente": {
            "id": str(cli.id),
            "nome": "JA CADASTRADO",
            "cnpj_cpf": "22333444000155",
        },
        "descricao": "NF-e teste",
        "data_emissao": "2026-04-20",
        "parcelas": [{"vencimento": "2026-05-20", "valor": "100.00"}],
    }

    response = await client.post("/api/contas-receber/import-nfe", json=payload)

    assert response.status_code == 201
    assert response.json()["cliente_id"] == str(cli.id)

    clientes_q = await db_session.execute(
        select(Cliente).where(Cliente.cnpj_cpf == "22333444000155")
    )
    assert len(list(clientes_q.scalars().all())) == 1


async def test_import_nfe_receber_duplicada_retorna_409(
    client: AsyncClient, db_session: AsyncSession
):
    payload = {
        "chave_acesso": "66666666666666666666666666666666666666666666",
        "cliente": {"id": None, "nome": "X", "cnpj_cpf": "22333444000155"},
        "descricao": "NF-e teste",
        "data_emissao": "2026-04-20",
        "parcelas": [{"vencimento": "2026-05-20", "valor": "10.00"}],
    }

    r1 = await client.post("/api/contas-receber/import-nfe", json=payload)
    assert r1.status_code == 201

    r2 = await client.post("/api/contas-receber/import-nfe", json=payload)
    assert r2.status_code == 409
    detail = r2.json()["detail"]
    assert detail["code"] == "DUPLICATE"
    assert detail["direcao"] == "receber"
    assert len(detail["contas_receber_ids"]) == 1
