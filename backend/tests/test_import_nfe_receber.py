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


# ============= PDF NFS-e Joinville =============

NFSE_FIXTURES_DIR = Path(__file__).parent / "fixtures" / "nfse"


def nfse_fixture_path(name: str) -> Path:
    return NFSE_FIXTURES_DIR / name


async def test_preview_nfse_pdf_ok(client: AsyncClient):
    pdf_bytes = nfse_fixture_path("nfse_joinville_162.pdf").read_bytes()

    response = await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("nota.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["parsed"]["modelo"] == "NFSE"
    assert data["parsed"]["numero_nota"] == "162"
    assert data["parsed"]["emitente_cnpj"] == "53428953000111"  # LSC USINAGEM
    assert data["parsed"]["dest_cnpj_cpf"] == "00477761000139"  # Víqua
    assert len(data["parsed"]["chave_acesso"]) == 50
    assert data["cliente"] is None
    assert "162" in data["sugestoes"]["descricao"]


async def test_preview_nfse_pdf_vincula_cliente_existente(
    client: AsyncClient, db_session: AsyncSession
):
    cli = Cliente(nome="VÍQUA JÁ CADASTRADA", cnpj_cpf="00477761000139")
    db_session.add(cli)
    await db_session.commit()

    pdf_bytes = nfse_fixture_path("nfse_joinville_162.pdf").read_bytes()
    response = await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("nota.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["cliente"] is not None
    assert data["cliente"]["id"] == str(cli.id)


async def test_import_nfse_pdf_cria_conta_receber(
    client: AsyncClient, db_session: AsyncSession
):
    pdf_bytes = nfse_fixture_path("nfse_joinville_162.pdf").read_bytes()

    # 1) Preview
    preview_resp = await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("nota.pdf", pdf_bytes, "application/pdf")},
    )
    assert preview_resp.status_code == 200
    preview = preview_resp.json()

    # 2) Import
    payload = {
        "chave_acesso": preview["parsed"]["chave_acesso"],
        "cliente": {
            "id": None,
            "nome": preview["parsed"]["dest_nome"],
            "cnpj_cpf": preview["parsed"]["dest_cnpj_cpf"],
            "email": None,
        },
        "descricao": preview["sugestoes"]["descricao"],
        "observacoes": preview["sugestoes"]["observacoes"],
        "data_emissao": preview["parsed"]["data_emissao"],
        "parcelas": [
            {"vencimento": p["vencimento"], "valor": p["valor"]}
            for p in preview["parsed"]["parcelas"]
        ],
    }
    import_resp = await client.post("/api/contas-receber/import-nfe", json=payload)
    assert import_resp.status_code == 201, import_resp.text
    body = import_resp.json()
    assert len(body["contas_receber_ids"]) == 1

    # 3) Conta a receber persistida
    import uuid as _uuid
    result = await db_session.execute(
        select(ContaReceber).where(ContaReceber.id == _uuid.UUID(body["contas_receber_ids"][0]))
    )
    conta = result.scalar_one()
    assert float(conta.valor) == 10776.00

    # 4) NotaFiscal registrada com chave de 50 chars
    result = await db_session.execute(
        select(NotaFiscal).where(NotaFiscal.id == _uuid.UUID(body["nota_fiscal_id"]))
    )
    nota = result.scalar_one()
    assert len(nota.chave_acesso) == 50
    assert nota.modelo == "NFSE"
    assert nota.direcao == "receber"


async def test_import_nfse_pdf_duplicate(client: AsyncClient):
    pdf_bytes = nfse_fixture_path("nfse_joinville_162.pdf").read_bytes()

    # Primeira importação
    preview = (await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("n.pdf", pdf_bytes, "application/pdf")},
    )).json()
    payload = {
        "chave_acesso": preview["parsed"]["chave_acesso"],
        "cliente": {
            "id": None,
            "nome": preview["parsed"]["dest_nome"],
            "cnpj_cpf": preview["parsed"]["dest_cnpj_cpf"],
            "email": None,
        },
        "descricao": preview["sugestoes"]["descricao"],
        "observacoes": "",
        "data_emissao": preview["parsed"]["data_emissao"],
        "parcelas": [
            {"vencimento": p["vencimento"], "valor": p["valor"]}
            for p in preview["parsed"]["parcelas"]
        ],
    }
    first = await client.post("/api/contas-receber/import-nfe", json=payload)
    assert first.status_code == 201

    # Segunda tentativa de preview do mesmo PDF
    dup_resp = await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("n.pdf", pdf_bytes, "application/pdf")},
    )
    assert dup_resp.status_code == 409
    detail = dup_resp.json()["detail"]
    assert detail["code"] == "DUPLICATE"
    assert detail["direcao"] == "receber"


async def test_preview_pdf_invalido(client: AsyncClient):
    response = await client.post(
        "/api/contas-receber/preview-nfe",
        files={"file": ("nao_e_pdf.pdf", b"not a real pdf", "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "INVALID_PDF"
