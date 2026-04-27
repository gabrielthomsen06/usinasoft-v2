# Importação de NF-e via XML — Plano de Execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário anexe um XML de NF-e modelo 55 na tela Contas a Pagar, revise os campos pré-preenchidos em um modal e crie N contas a pagar (uma por parcela do XML).

**Architecture:** Endpoint `preview-nfe` parseia o XML com `defusedxml`, retorna dados extraídos sem persistir. Frontend abre modal de revisão. Endpoint `import-nfe` cria fornecedor (se novo), N `ContaPagar` com mesmo `grupo_parcelas_id`, e registra metadados em `notas_fiscais`. Idempotência via `UNIQUE(chave_acesso)`.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + defusedxml (backend); React + TypeScript + Tailwind (frontend); pytest + pytest-asyncio + aiosqlite (testes).

**Spec:** `docs/superpowers/specs/2026-04-27-importar-nfe-xml-design.md`

**XML real do cliente:** `C:\Users\gabri\Downloads\42260417888968000107550010000154731674299207-procNFe.xml` — copiar para `backend/tests/fixtures/nfe/nfe_55_1_parcela_real.xml` na Fase 2.

---

## Estrutura de arquivos

**Novos:**
- `backend/pytest.ini` — config do pytest
- `backend/tests/__init__.py`
- `backend/tests/conftest.py` — fixtures de db (sqlite em memória) e client autenticado
- `backend/tests/fixtures/nfe/` — XMLs de teste (1 real + 5 sintéticos)
- `backend/tests/test_nfe_parser.py` — testes unitários do parser
- `backend/tests/test_import_nfe.py` — testes de integração dos endpoints
- `backend/app/models/nota_fiscal.py` — model `NotaFiscal`
- `backend/app/schemas/nfe.py` — schemas Pydantic do parsing e da API
- `backend/app/services/nfe_parser.py` — função `parse_nfe_xml` + exceção `NFeParserError`
- `backend/app/services/nota_fiscal_service.py` — preview + import (lógica de DB)
- `backend/alembic/versions/<hash>_create_notas_fiscais.py` — migração
- `frontend/src/types/nfe.ts` — types mirror dos schemas
- `frontend/src/services/nfe.ts` — `previewNfe` e `importNfe`
- `frontend/src/components/contas-pagar/ImportarNFEModal.tsx` — modal de revisão

**Alterados:**
- `backend/requirements.txt` — adicionar `defusedxml`, `pytest`, `pytest-asyncio`, `aiosqlite`
- `backend/alembic/env.py` — importar `nota_fiscal`
- `backend/app/api/routes/contas_pagar.py` — endpoints `preview-nfe` e `import-nfe`
- `frontend/src/pages/ContasPagar.tsx` — botão "Importar XML" + integração do modal

---

## Fase 0 — Infra de testes

**Por quê:** Não há pytest hoje. Antes do TDD do parser, precisamos de pytest configurado e um `conftest.py` mínimo para testes async com FastAPI + SQLAlchemy. Usamos SQLite em memória para velocidade — `Base.metadata.create_all` cria o schema sem rodar Alembic (evita SQL Postgres-only das migrations).

### Task 0.1: Adicionar dependências de teste e segurança XML

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Adicionar 4 dependências ao requirements.txt**

Acrescentar ao final do arquivo:

```
defusedxml==0.7.1
pytest==8.0.0
pytest-asyncio==0.23.5
aiosqlite==0.19.0
```

- [ ] **Step 2: Instalar no venv**

```bash
cd backend && venv/Scripts/pip install -r requirements.txt
```

Esperado: instalação bem-sucedida das 4 novas libs.

- [ ] **Step 3: Verificar imports**

```bash
cd backend && venv/Scripts/python -c "import defusedxml.ElementTree; import pytest; import aiosqlite; print('ok')"
```

Esperado: `ok`.

### Task 0.2: pytest.ini

**Files:**
- Create: `backend/pytest.ini`

- [ ] **Step 1: Escrever pytest.ini**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
filterwarnings =
    ignore::DeprecationWarning
```

- [ ] **Step 2: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini
git commit -m "test: setup pytest + defusedxml dependencies"
```

### Task 0.3: conftest.py com fixtures de db e client

**Files:**
- Create: `backend/tests/__init__.py` (vazio)
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Criar tests/__init__.py**

Arquivo vazio.

- [ ] **Step 2: Escrever conftest.py**

```python
import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.api.deps import get_current_admin_user
from app.main import app
from app.models.usuario import Usuario


# Importar todos os models para registrar no metadata
from app.models import (  # noqa: F401
    usuario, cliente, peca, ordem_producao, fornecedor,
    conta_receber, conta_pagar, lancamento, nota_fiscal,
)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    SessionLocal = async_sessionmaker(bind=db_engine, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> Usuario:
    user = Usuario(
        id=uuid.uuid4(),
        email="admin@test.com",
        password_hash="x",
        first_name="Admin",
        last_name="Test",
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, admin_user: Usuario) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    async def override_admin():
        return admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_admin_user] = override_admin

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
```

- [ ] **Step 3: Smoke test — pytest reconhece conftest**

```bash
cd backend && venv/Scripts/pytest --collect-only
```

Esperado: `0 tests collected` sem erros de import.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/__init__.py backend/tests/conftest.py
git commit -m "test: add pytest fixtures (sqlite in-memory + httpx client)"
```

---

## Fase 1 — Backend: model `NotaFiscal` + migração Alembic

### Task 1.1: Model NotaFiscal

**Files:**
- Create: `backend/app/models/nota_fiscal.py`

- [ ] **Step 1: Escrever o model**

```python
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class NotaFiscal(Base):
    __tablename__ = "notas_fiscais"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chave_acesso: Mapped[str] = mapped_column(
        String(44), unique=True, nullable=False, index=True
    )
    numero_nota: Mapped[str] = mapped_column(String(20), nullable=False)
    serie: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    modelo: Mapped[str] = mapped_column(String(2), nullable=False)
    cnpj_emitente: Mapped[str] = mapped_column(String(14), nullable=False, index=True)
    nome_emitente: Mapped[str] = mapped_column(String(255), nullable=False)
    valor_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    data_emissao: Mapped[date] = mapped_column(Date, nullable=False)
    grupo_parcelas_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False
    )
```

- [ ] **Step 2: Registrar no env.py do Alembic**

Modificar `backend/alembic/env.py:19` para incluir `nota_fiscal`:

```python
from app.models import usuario, cliente, peca, ordem_producao, fornecedor, conta_receber, conta_pagar, lancamento, nota_fiscal  # noqa: F401
```

- [ ] **Step 3: Verificar import**

```bash
cd backend && venv/Scripts/python -c "from app.models.nota_fiscal import NotaFiscal; print(NotaFiscal.__tablename__)"
```

Esperado: `notas_fiscais`.

### Task 1.2: Migração Alembic

**Files:**
- Create: `backend/alembic/versions/<hash>_create_notas_fiscais.py`

- [ ] **Step 1: Gerar migração via autogenerate**

```bash
cd backend && venv/Scripts/alembic revision --autogenerate -m "create_notas_fiscais"
```

Esperado: arquivo gerado em `backend/alembic/versions/<hash>_create_notas_fiscais.py`.

- [ ] **Step 2: Revisar e ajustar a migração gerada**

Conteúdo esperado (ajustar se autogenerate diferir):

```python
"""create_notas_fiscais

Revision ID: <hash>
Revises: f1a2b3c4d5e6
Create Date: 2026-04-27 ...
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = '<hash>'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notas_fiscais',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('chave_acesso', sa.String(length=44), nullable=False),
        sa.Column('numero_nota', sa.String(length=20), nullable=False),
        sa.Column('serie', sa.String(length=10), nullable=True),
        sa.Column('modelo', sa.String(length=2), nullable=False),
        sa.Column('cnpj_emitente', sa.String(length=14), nullable=False),
        sa.Column('nome_emitente', sa.String(length=255), nullable=False),
        sa.Column('valor_total', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('data_emissao', sa.Date(), nullable=False),
        sa.Column('grupo_parcelas_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by_user_id', UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['usuarios.id']),
        sa.UniqueConstraint('chave_acesso', name='uq_notas_fiscais_chave_acesso'),
    )
    op.create_index('ix_notas_fiscais_chave_acesso', 'notas_fiscais', ['chave_acesso'])
    op.create_index('ix_notas_fiscais_cnpj_emitente', 'notas_fiscais', ['cnpj_emitente'])


def downgrade() -> None:
    op.drop_index('ix_notas_fiscais_cnpj_emitente', table_name='notas_fiscais')
    op.drop_index('ix_notas_fiscais_chave_acesso', table_name='notas_fiscais')
    op.drop_table('notas_fiscais')
```

- [ ] **Step 3: Aplicar migração no banco local de desenvolvimento (opcional, mas recomendado)**

```bash
cd backend && venv/Scripts/alembic upgrade head
```

Esperado: `Running upgrade f1a2b3c4d5e6 -> <hash>, create_notas_fiscais`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/nota_fiscal.py backend/alembic/env.py backend/alembic/versions/
git commit -m "feat(model): add NotaFiscal + alembic migration"
```

---

## Fase 2 — Backend: parser `nfe_parser.py` (TDD)

### Task 2.1: Schemas Pydantic do parsing

**Files:**
- Create: `backend/app/schemas/nfe.py`

- [ ] **Step 1: Escrever schemas**

```python
import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class NFeParcelaParsed(BaseModel):
    numero: str
    vencimento: date
    valor: Decimal


class NFeItemParsed(BaseModel):
    descricao: str
    quantidade: Decimal
    valor_total: Decimal


class NFeParsedData(BaseModel):
    chave_acesso: str
    numero_nota: str
    serie: str
    modelo: str
    data_emissao: date
    valor_total: Decimal
    emitente_cnpj: str
    emitente_nome: str
    emitente_fantasia: Optional[str] = None
    emitente_email: Optional[str] = None
    parcelas: List[NFeParcelaParsed] = Field(default_factory=list)
    itens: List[NFeItemParsed] = Field(default_factory=list)


class FornecedorVinculado(BaseModel):
    id: uuid.UUID
    nome: str


class PreviewSugestoes(BaseModel):
    descricao: str
    categoria: str
    observacoes: str


class PreviewNFeResponse(BaseModel):
    parsed: NFeParsedData
    fornecedor: Optional[FornecedorVinculado] = None
    sugestoes: PreviewSugestoes


class FornecedorImportInput(BaseModel):
    id: Optional[uuid.UUID] = None
    nome: str
    cnpj: str
    email: Optional[str] = None


class ParcelaImportInput(BaseModel):
    vencimento: date
    valor: Decimal


class ImportNFeRequest(BaseModel):
    chave_acesso: str
    fornecedor: FornecedorImportInput
    descricao: str
    categoria: str
    observacoes: Optional[str] = None
    data_emissao: date
    parcelas: List[ParcelaImportInput]


class ImportNFeResponse(BaseModel):
    contas_pagar_ids: List[uuid.UUID]
    fornecedor_id: uuid.UUID
    nota_fiscal_id: uuid.UUID


class DuplicateNFeError(BaseModel):
    code: str = "DUPLICATE"
    chave_acesso: str
    importada_em: date
    contas_pagar_ids: List[uuid.UUID]
```

- [ ] **Step 2: Verificar import**

```bash
cd backend && venv/Scripts/python -c "from app.schemas.nfe import NFeParsedData; print('ok')"
```

Esperado: `ok`.

### Task 2.2: Fixtures XML

**Files:**
- Create: `backend/tests/fixtures/nfe/nfe_55_1_parcela_real.xml` (cópia do XML do cliente)
- Create: `backend/tests/fixtures/nfe/nfe_55_3_parcelas.xml`
- Create: `backend/tests/fixtures/nfe/nfe_55_sem_cobr.xml`
- Create: `backend/tests/fixtures/nfe/nfe_55_cancelada.xml`
- Create: `backend/tests/fixtures/nfe/nfc_e_modelo_65.xml`
- Create: `backend/tests/fixtures/nfe/xml_malformado.xml`
- Create: `backend/tests/fixtures/nfe/nao_nfe.xml`

- [ ] **Step 1: Copiar XML real do cliente**

```bash
mkdir -p backend/tests/fixtures/nfe
cp "C:/Users/gabri/Downloads/42260417888968000107550010000154731674299207-procNFe.xml" backend/tests/fixtures/nfe/nfe_55_1_parcela_real.xml
```

- [ ] **Step 2: Criar `nfe_55_3_parcelas.xml`**

XML mínimo com 3 duplicatas. Conteúdo:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe11111111111111111111111111111111111111111111" versao="4.00">
      <ide>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>999</nNF>
        <dhEmi>2026-04-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>11222333000144</CNPJ>
        <xNome>FORNECEDOR TESTE LTDA</xNome>
        <xFant>FORNEC TESTE</xFant>
      </emit>
      <det nItem="1">
        <prod>
          <xProd>PARAFUSO M8</xProd>
          <qCom>10.0000</qCom>
          <vProd>300.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>300.00</vNF>
        </ICMSTot>
      </total>
      <cobr>
        <dup><nDup>001</nDup><dVenc>2026-05-01</dVenc><vDup>100.00</vDup></dup>
        <dup><nDup>002</nDup><dVenc>2026-06-01</dVenc><vDup>100.00</vDup></dup>
        <dup><nDup>003</nDup><dVenc>2026-07-01</dVenc><vDup>100.00</vDup></dup>
      </cobr>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>11111111111111111111111111111111111111111111</chNFe>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>
```

- [ ] **Step 3: Criar `nfe_55_sem_cobr.xml`**

Igual ao anterior mas SEM o bloco `<cobr>` e com chave/numero diferentes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe22222222222222222222222222222222222222222222" versao="4.00">
      <ide>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>1000</nNF>
        <dhEmi>2026-04-15T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>11222333000144</CNPJ>
        <xNome>FORNECEDOR A VISTA</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <xProd>ITEM A VISTA</xProd>
          <qCom>1.0000</qCom>
          <vProd>50.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>50.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>22222222222222222222222222222222222222222222</chNFe>
      <cStat>100</cStat>
    </infProt>
  </protNFe>
</nfeProc>
```

- [ ] **Step 4: Criar `nfe_55_cancelada.xml`**

Igual ao 3-parcelas mas com `<cStat>101</cStat>` (cancelada) e chave diferente:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe33333333333333333333333333333333333333333333" versao="4.00">
      <ide><mod>55</mod><serie>1</serie><nNF>1001</nNF><dhEmi>2026-04-15T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>11222333000144</CNPJ><xNome>FORN CANCELADA</xNome></emit>
      <total><ICMSTot><vNF>10.00</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>33333333333333333333333333333333333333333333</chNFe>
      <cStat>101</cStat>
      <xMotivo>Cancelamento de NF-e homologado</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>
```

- [ ] **Step 5: Criar `nfc_e_modelo_65.xml`**

Igual estrutura de NF-e mas `<mod>65</mod>`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe44444444444444444444444444444444444444444444" versao="4.00">
      <ide><mod>65</mod><serie>1</serie><nNF>500</nNF><dhEmi>2026-04-15T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>11222333000144</CNPJ><xNome>VAREJO TESTE</xNome></emit>
      <total><ICMSTot><vNF>15.00</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt><chNFe>44444444444444444444444444444444444444444444</chNFe><cStat>100</cStat></infProt>
  </protNFe>
</nfeProc>
```

- [ ] **Step 6: Criar `xml_malformado.xml`**

```xml
<?xml version="1.0"?><nfeProc><NFe><infNFe Id="aaa">
```

(XML truncado intencionalmente)

- [ ] **Step 7: Criar `nao_nfe.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<documento>
  <tipo>contrato</tipo>
  <numero>123</numero>
</documento>
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/nfe.py backend/tests/fixtures/nfe/
git commit -m "test(nfe): add parser schemas + xml fixtures"
```

### Task 2.3: TDD parser — caso 1 parcela (XML real)

**Files:**
- Create: `backend/tests/test_nfe_parser.py`
- Create: `backend/app/services/nfe_parser.py`

- [ ] **Step 1: Escrever o primeiro teste**

```python
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
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
cd backend && venv/Scripts/pytest tests/test_nfe_parser.py::test_parse_real_nfe_pwm_1_parcela -v
```

Esperado: `ImportError` ou `AttributeError` em `app.services.nfe_parser`.

- [ ] **Step 3: Implementar parser mínimo**

Criar `backend/app/services/nfe_parser.py`:

```python
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import defusedxml.ElementTree as ET
from xml.etree.ElementTree import Element

from app.schemas.nfe import NFeItemParsed, NFeParcelaParsed, NFeParsedData


NFE_NS = "{http://www.portalfiscal.inf.br/nfe}"


class NFeParserError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


def _find(elem: Element, path: str) -> Optional[Element]:
    """Find with NF-e namespace prepended to each path segment."""
    parts = path.split("/")
    ns_path = "/".join(f"{NFE_NS}{p}" for p in parts)
    return elem.find(ns_path)


def _findall(elem: Element, path: str) -> list[Element]:
    parts = path.split("/")
    ns_path = "/".join(f"{NFE_NS}{p}" for p in parts)
    return elem.findall(ns_path)


def _text(elem: Optional[Element]) -> Optional[str]:
    return elem.text.strip() if elem is not None and elem.text else None


def _required_text(elem: Element, path: str, code: str = "MISSING_FIELDS") -> str:
    target = _find(elem, path)
    value = _text(target)
    if value is None:
        raise NFeParserError(code, f"Campo obrigatório ausente: {path}")
    return value


def parse_nfe_xml(xml_bytes: bytes) -> NFeParsedData:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        raise NFeParserError("INVALID_XML", "Arquivo XML inválido") from e

    tag = root.tag
    if tag == f"{NFE_NS}nfeProc":
        nfe_node = _find(root, "NFe")
        prot_node = _find(root, "protNFe")
    elif tag == f"{NFE_NS}NFe":
        nfe_node = root
        prot_node = None
    else:
        raise NFeParserError("NOT_NFE", "Arquivo não é uma NF-e")

    if nfe_node is None:
        raise NFeParserError("NOT_NFE", "Arquivo não é uma NF-e")

    inf_nfe = _find(nfe_node, "infNFe")
    if inf_nfe is None:
        raise NFeParserError("NOT_NFE", "Arquivo não é uma NF-e")

    modelo = _required_text(inf_nfe, "ide/mod")
    if modelo != "55":
        raise NFeParserError(
            "UNSUPPORTED_MODEL",
            "Apenas NF-e modelo 55 é suportada",
        )

    if prot_node is not None:
        c_stat = _text(_find(prot_node, "infProt/cStat"))
        if c_stat != "100":
            raise NFeParserError(
                "NOT_AUTHORIZED",
                f"NF-e não autorizada (status {c_stat})",
            )

    if prot_node is not None:
        chave = _text(_find(prot_node, "infProt/chNFe"))
    else:
        chave = None
    if not chave:
        inf_id = inf_nfe.get("Id", "")
        chave = inf_id[3:] if inf_id.startswith("NFe") else inf_id
    if not chave or len(chave) != 44:
        raise NFeParserError("MISSING_FIELDS", "Chave de acesso não encontrada")

    numero = _required_text(inf_nfe, "ide/nNF")
    serie = _text(_find(inf_nfe, "ide/serie")) or ""

    dh_emi = _required_text(inf_nfe, "ide/dhEmi")
    data_emissao = datetime.fromisoformat(dh_emi).date()

    v_nf = _required_text(inf_nfe, "total/ICMSTot/vNF")
    valor_total = Decimal(v_nf)

    cnpj = _required_text(inf_nfe, "emit/CNPJ")
    nome = _required_text(inf_nfe, "emit/xNome")
    fantasia = _text(_find(inf_nfe, "emit/xFant"))
    email = _text(_find(inf_nfe, "emit/email"))

    parcelas: list[NFeParcelaParsed] = []
    for dup in _findall(inf_nfe, "cobr/dup"):
        n = _text(_find(dup, "nDup")) or ""
        d = _text(_find(dup, "dVenc"))
        v = _text(_find(dup, "vDup"))
        if d and v:
            parcelas.append(
                NFeParcelaParsed(
                    numero=n,
                    vencimento=date.fromisoformat(d),
                    valor=Decimal(v),
                )
            )

    itens: list[NFeItemParsed] = []
    for det in _findall(inf_nfe, "det"):
        prod = _find(det, "prod")
        if prod is None:
            continue
        descr = _text(_find(prod, "xProd")) or ""
        qtd = _text(_find(prod, "qCom")) or "0"
        vprod = _text(_find(prod, "vProd")) or "0"
        itens.append(
            NFeItemParsed(
                descricao=descr,
                quantidade=Decimal(qtd),
                valor_total=Decimal(vprod),
            )
        )

    return NFeParsedData(
        chave_acesso=chave,
        numero_nota=numero,
        serie=serie,
        modelo=modelo,
        data_emissao=data_emissao,
        valor_total=valor_total,
        emitente_cnpj=cnpj,
        emitente_nome=nome,
        emitente_fantasia=fantasia,
        emitente_email=email,
        parcelas=parcelas,
        itens=itens,
    )
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
cd backend && venv/Scripts/pytest tests/test_nfe_parser.py::test_parse_real_nfe_pwm_1_parcela -v
```

Esperado: PASS.

### Task 2.4: TDD parser — N parcelas, sem cobr, cancelada

**Files:**
- Modify: `backend/tests/test_nfe_parser.py`

- [ ] **Step 1: Adicionar 3 testes**

```python
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
```

- [ ] **Step 2: Rodar testes — devem passar (parser já trata os 3 casos)**

```bash
cd backend && venv/Scripts/pytest tests/test_nfe_parser.py -v
```

Esperado: 4 testes PASS.

### Task 2.5: TDD parser — modelos errados / XML inválido

- [ ] **Step 1: Adicionar testes de erro**

```python
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
```

- [ ] **Step 2: Rodar testes**

```bash
cd backend && venv/Scripts/pytest tests/test_nfe_parser.py -v
```

Esperado: 7 testes PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/nfe_parser.py backend/tests/test_nfe_parser.py
git commit -m "feat(nfe): add NF-e XML parser with TDD"
```

---

## Fase 3 — Backend: service + endpoints (TDD)

### Task 3.1: Service de preview e import

**Files:**
- Create: `backend/app/services/nota_fiscal_service.py`

- [ ] **Step 1: Implementar service**

```python
import uuid
from datetime import date, timedelta
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.conta_pagar import ContaPagar
from app.models.fornecedor import Fornecedor
from app.models.nota_fiscal import NotaFiscal
from app.models.usuario import Usuario
from app.schemas.nfe import (
    FornecedorVinculado,
    ImportNFeRequest,
    ImportNFeResponse,
    NFeParsedData,
    PreviewNFeResponse,
    PreviewSugestoes,
)
from app.services.nfe_parser import parse_nfe_xml, NFeParserError


async def _find_existing_nota(
    db: AsyncSession, chave: str
) -> Optional[NotaFiscal]:
    result = await db.execute(
        select(NotaFiscal).where(NotaFiscal.chave_acesso == chave)
    )
    return result.scalar_one_or_none()


async def _find_contas_by_grupo(
    db: AsyncSession, grupo_id: Optional[uuid.UUID]
) -> List[uuid.UUID]:
    if grupo_id is None:
        return []
    result = await db.execute(
        select(ContaPagar.id).where(ContaPagar.grupo_parcelas_id == grupo_id)
    )
    return [r for r in result.scalars().all()]


def _format_observacoes(parsed: NFeParsedData) -> str:
    chave_fmt = " ".join(
        parsed.chave_acesso[i:i + 4] for i in range(0, len(parsed.chave_acesso), 4)
    )
    linhas = [f"Chave: {chave_fmt}", "Itens:"]
    for it in parsed.itens:
        qtd_fmt = f"{it.quantidade.normalize():f}".rstrip("0").rstrip(".")
        linhas.append(
            f"- {qtd_fmt}x {it.descricao} (R$ {it.valor_total:.2f})"
        )
    return "\n".join(linhas)


def _build_sugestoes(parsed: NFeParsedData) -> PreviewSugestoes:
    nome_curto = parsed.emitente_fantasia or parsed.emitente_nome
    return PreviewSugestoes(
        descricao=f"NF-e nº {parsed.numero_nota} - {nome_curto}",
        categoria="material",
        observacoes=_format_observacoes(parsed),
    )


async def preview_nfe(
    db: AsyncSession, xml_bytes: bytes
) -> PreviewNFeResponse:
    try:
        parsed = parse_nfe_xml(xml_bytes)
    except NFeParserError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": e.code, "message": e.message},
        )

    existing = await _find_existing_nota(db, parsed.chave_acesso)
    if existing:
        contas_ids = await _find_contas_by_grupo(db, existing.grupo_parcelas_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "DUPLICATE",
                "chave_acesso": existing.chave_acesso,
                "importada_em": existing.created_at.date().isoformat(),
                "contas_pagar_ids": [str(c) for c in contas_ids],
            },
        )

    fornecedor_link = None
    forn_result = await db.execute(
        select(Fornecedor).where(Fornecedor.cnpj_cpf == parsed.emitente_cnpj)
    )
    forn = forn_result.scalar_one_or_none()
    if forn:
        fornecedor_link = FornecedorVinculado(id=forn.id, nome=forn.nome)

    return PreviewNFeResponse(
        parsed=parsed,
        fornecedor=fornecedor_link,
        sugestoes=_build_sugestoes(parsed),
    )


async def import_nfe(
    db: AsyncSession, payload: ImportNFeRequest, user: Usuario
) -> ImportNFeResponse:
    existing = await _find_existing_nota(db, payload.chave_acesso)
    if existing:
        contas_ids = await _find_contas_by_grupo(db, existing.grupo_parcelas_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "DUPLICATE",
                "chave_acesso": existing.chave_acesso,
                "importada_em": existing.created_at.date().isoformat(),
                "contas_pagar_ids": [str(c) for c in contas_ids],
            },
        )

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
        grupo_parcelas_id=grupo_id,
        created_by_user_id=user.id,
    )
    db.add(nota)

    await db.flush()

    return ImportNFeResponse(
        contas_pagar_ids=[c.id for c in contas],
        fornecedor_id=fornecedor.id,
        nota_fiscal_id=nota.id,
    )
```

> **Nota:** o service preenche `numero_nota=""` e `serie=None` no record `NotaFiscal` porque o payload de import (vindo do modal) não inclui esses campos — o que importa em V1 é a chave (deduplicação) e o link via `grupo_parcelas_id`. Se quiser persistir nNF/serie, adicione-os ao `ImportNFeRequest`. Spec V1 não exige.

- [ ] **Step 2: Verificar import**

```bash
cd backend && venv/Scripts/python -c "from app.services.nota_fiscal_service import preview_nfe, import_nfe; print('ok')"
```

Esperado: `ok`.

### Task 3.2: Endpoints na rota contas_pagar

**Files:**
- Modify: `backend/app/api/routes/contas_pagar.py`

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```python
import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_admin_user
from app.models.usuario import Usuario
from app.schemas.conta_pagar import ContaPagarCreate, ContaPagarResponse, ContaPagarUpdate
from app.schemas.nfe import (
    ImportNFeRequest,
    ImportNFeResponse,
    PreviewNFeResponse,
)
from app.services.conta_pagar_service import (
    list_contas_pagar,
    get_conta_pagar_by_id,
    create_conta_pagar,
    update_conta_pagar,
    delete_conta_pagar,
)
from app.services.nota_fiscal_service import import_nfe, preview_nfe

router = APIRouter(prefix="/contas-pagar", tags=["contas-pagar"])


MAX_XML_SIZE = 1 * 1024 * 1024  # 1 MB


@router.get("/", response_model=List[ContaPagarResponse])
async def list_all_contas_pagar(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = Query(None, alias="status"),
    categoria: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> List:
    return await list_contas_pagar(
        db, skip=skip, limit=limit, status_filter=status_filter,
        categoria=categoria, data_inicio=data_inicio, data_fim=data_fim,
    )


@router.post("/", response_model=List[ContaPagarResponse], status_code=status.HTTP_201_CREATED)
async def create_conta_pagar_route(
    data: ContaPagarCreate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> List[ContaPagarResponse]:
    return await create_conta_pagar(db, data)


@router.post("/preview-nfe", response_model=PreviewNFeResponse)
async def preview_nfe_route(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> PreviewNFeResponse:
    if file.content_type and file.content_type not in (
        "text/xml", "application/xml", "application/octet-stream",
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CONTENT_TYPE", "message": "Envie um arquivo XML"},
        )

    content = await file.read(MAX_XML_SIZE + 1)
    if len(content) > MAX_XML_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "FILE_TOO_LARGE", "message": "Arquivo maior que 1 MB"},
        )

    return await preview_nfe(db, content)


@router.post("/import-nfe", response_model=ImportNFeResponse, status_code=status.HTTP_201_CREATED)
async def import_nfe_route(
    payload: ImportNFeRequest,
    db: AsyncSession = Depends(get_db),
    user: Usuario = Depends(get_current_admin_user),
) -> ImportNFeResponse:
    return await import_nfe(db, payload, user)


@router.get("/{conta_id}", response_model=ContaPagarResponse)
async def get_conta_pagar_route(
    conta_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> ContaPagarResponse:
    return await get_conta_pagar_by_id(db, conta_id)


@router.put("/{conta_id}", response_model=ContaPagarResponse)
async def update_conta_pagar_route(
    conta_id: uuid.UUID,
    data: ContaPagarUpdate,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> ContaPagarResponse:
    return await update_conta_pagar(db, conta_id, data)


@router.delete("/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conta_pagar_route(
    conta_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> None:
    await delete_conta_pagar(db, conta_id)
```

- [ ] **Step 2: Smoke test — main importa**

```bash
cd backend && venv/Scripts/python -c "from app.main import app; print(len(app.routes))"
```

Esperado: número de rotas (não importa exato, só não quebrar).

### Task 3.3: TDD — preview-nfe sucesso

**Files:**
- Create: `backend/tests/test_import_nfe.py`

- [ ] **Step 1: Escrever primeiro teste**

```python
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fornecedor import Fornecedor


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "nfe"


def fixture_path(name: str) -> Path:
    return FIXTURES_DIR / name


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
    assert data["fornecedor"] is None  # ainda não cadastrado
    assert data["sugestoes"]["descricao"].startswith("NF-e nº 15473")
    assert data["sugestoes"]["categoria"] == "material"
```

- [ ] **Step 2: Rodar e verificar PASS**

```bash
cd backend && venv/Scripts/pytest tests/test_import_nfe.py -v
```

Esperado: PASS.

### Task 3.4: TDD — preview-nfe vincula fornecedor existente por CNPJ

- [ ] **Step 1: Adicionar teste**

```python
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
```

- [ ] **Step 2: Rodar e verificar PASS**

```bash
cd backend && venv/Scripts/pytest tests/test_import_nfe.py -v
```

Esperado: 2 PASS.

### Task 3.5: TDD — erros do parser viram 400

- [ ] **Step 1: Adicionar 3 testes**

```python
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
```

- [ ] **Step 2: Rodar e verificar PASS**

```bash
cd backend && venv/Scripts/pytest tests/test_import_nfe.py -v
```

Esperado: 5 PASS.

### Task 3.6: TDD — import-nfe cria fornecedor novo + N contas

- [ ] **Step 1: Adicionar teste**

```python
from sqlalchemy.future import select

from app.models.conta_pagar import ContaPagar
from app.models.nota_fiscal import NotaFiscal


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
    assert len(grupos) == 1  # mesmo grupo
    assert all(c.intervalo_dias == 31 for c in contas)  # 31 dias entre 05-01 e 06-01

    nota_q = await db_session.execute(
        select(NotaFiscal).where(
            NotaFiscal.chave_acesso == "11111111111111111111111111111111111111111111"
        )
    )
    nota = nota_q.scalar_one()
    assert nota.grupo_parcelas_id == contas[0].grupo_parcelas_id
```

- [ ] **Step 2: Rodar e verificar PASS**

```bash
cd backend && venv/Scripts/pytest tests/test_import_nfe.py -v
```

Esperado: 6 PASS.

### Task 3.7: TDD — import-nfe usa fornecedor existente quando id é passado

- [ ] **Step 1: Adicionar teste**

```python
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
    assert len(list(fornecedores_q.scalars().all())) == 1  # nenhum duplicado
```

- [ ] **Step 2: Rodar e verificar PASS**

```bash
cd backend && venv/Scripts/pytest tests/test_import_nfe.py -v
```

Esperado: 7 PASS.

### Task 3.8: TDD — duplicidade de chave retorna 409

- [ ] **Step 1: Adicionar 2 testes**

```python
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
```

- [ ] **Step 2: Rodar e verificar PASS**

```bash
cd backend && venv/Scripts/pytest tests/test_import_nfe.py -v
```

Esperado: 9 PASS.

### Task 3.9: Validação de tamanho de arquivo

- [ ] **Step 1: Adicionar teste**

```python
async def test_preview_nfe_arquivo_muito_grande_retorna_413(client: AsyncClient):
    big = b"<?xml version='1.0'?><x>" + b"a" * (1024 * 1024 + 100) + b"</x>"

    response = await client.post(
        "/api/contas-pagar/preview-nfe",
        files={"file": ("big.xml", big, "application/xml")},
    )

    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "FILE_TOO_LARGE"
```

- [ ] **Step 2: Rodar e verificar PASS**

```bash
cd backend && venv/Scripts/pytest tests/test_import_nfe.py -v
```

Esperado: 10 PASS.

- [ ] **Step 3: Rodar todo o test suite**

```bash
cd backend && venv/Scripts/pytest -v
```

Esperado: parser (7) + integração (10) = 17 PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/nota_fiscal_service.py backend/app/api/routes/contas_pagar.py backend/tests/test_import_nfe.py
git commit -m "feat(nfe): add preview-nfe and import-nfe endpoints"
```

---

## Fase 4 — Frontend: types + service

### Task 4.1: Types

**Files:**
- Create: `frontend/src/types/nfe.ts`

- [ ] **Step 1: Escrever types**

```typescript
export interface NFeParcelaParsed {
  numero: string;
  vencimento: string; // ISO date
  valor: string; // Decimal serializado
}

export interface NFeItemParsed {
  descricao: string;
  quantidade: string;
  valor_total: string;
}

export interface NFeParsedData {
  chave_acesso: string;
  numero_nota: string;
  serie: string;
  modelo: string;
  data_emissao: string;
  valor_total: string;
  emitente_cnpj: string;
  emitente_nome: string;
  emitente_fantasia?: string | null;
  emitente_email?: string | null;
  parcelas: NFeParcelaParsed[];
  itens: NFeItemParsed[];
}

export interface FornecedorVinculado {
  id: string;
  nome: string;
}

export interface PreviewSugestoes {
  descricao: string;
  categoria: string;
  observacoes: string;
}

export interface PreviewNFeResponse {
  parsed: NFeParsedData;
  fornecedor: FornecedorVinculado | null;
  sugestoes: PreviewSugestoes;
}

export interface ImportNFeFornecedor {
  id?: string | null;
  nome: string;
  cnpj: string;
  email?: string | null;
}

export interface ImportNFeParcela {
  vencimento: string;
  valor: string;
}

export interface ImportNFePayload {
  chave_acesso: string;
  fornecedor: ImportNFeFornecedor;
  descricao: string;
  categoria: string;
  observacoes?: string | null;
  data_emissao: string;
  parcelas: ImportNFeParcela[];
}

export interface ImportNFeResponse {
  contas_pagar_ids: string[];
  fornecedor_id: string;
  nota_fiscal_id: string;
}

export interface NFeApiError {
  code: string;
  message?: string;
  chave_acesso?: string;
  importada_em?: string;
  contas_pagar_ids?: string[];
}
```

### Task 4.2: Service

**Files:**
- Create: `frontend/src/services/nfe.ts`

- [ ] **Step 1: Escrever service**

```typescript
import api from './api';
import {
  ImportNFePayload,
  ImportNFeResponse,
  PreviewNFeResponse,
} from '../types/nfe';

export const nfeService = {
  async preview(file: File): Promise<PreviewNFeResponse> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<PreviewNFeResponse>(
      '/contas-pagar/preview-nfe',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async import(payload: ImportNFePayload): Promise<ImportNFeResponse> {
    const { data } = await api.post<ImportNFeResponse>(
      '/contas-pagar/import-nfe',
      payload,
    );
    return data;
  },
};
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/nfe.ts frontend/src/services/nfe.ts
git commit -m "feat(frontend): add NF-e types and service"
```

---

## Fase 5 — Frontend: ImportarNFEModal + integração

### Task 5.1: Componente ImportarNFEModal

**Files:**
- Create: `frontend/src/components/contas-pagar/ImportarNFEModal.tsx`

- [ ] **Step 1: Criar diretório e componente**

```bash
mkdir -p frontend/src/components/contas-pagar
```

Conteúdo de `ImportarNFEModal.tsx`:

```tsx
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { nfeService } from '../../services/nfe';
import {
  ImportNFePayload,
  NFeApiError,
  PreviewNFeResponse,
} from '../../types/nfe';

type Stage = 'idle' | 'uploading' | 'reviewing' | 'saving' | 'error';

interface ImportarNFEModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParcelaForm {
  numero: string;
  vencimento: string;
  valor: string;
}

const categorias = [
  'material', 'servicos', 'fixas', 'impostos', 'carro', 'gasolina',
  'salario', 'aluguel', 'patrimonio', 'outros',
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ImportarNFEModal({ isOpen, onClose, onImported }: ImportarNFEModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<PreviewNFeResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<NFeApiError | null>(null);

  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('material');
  const [observacoes, setObservacoes] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([]);

  const reset = () => {
    setStage('idle');
    setPreview(null);
    setErrorInfo(null);
    setDescricao('');
    setCategoria('material');
    setObservacoes('');
    setDataEmissao('');
    setParcelas([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setStage('uploading');
    setErrorInfo(null);
    try {
      const data = await nfeService.preview(file);
      setPreview(data);
      setDescricao(data.sugestoes.descricao);
      setCategoria(data.sugestoes.categoria);
      setObservacoes(data.sugestoes.observacoes);
      setDataEmissao(data.parsed.data_emissao);
      const parcs = data.parsed.parcelas.length > 0
        ? data.parsed.parcelas.map((p) => ({
            numero: p.numero,
            vencimento: p.vencimento,
            valor: p.valor,
          }))
        : [{
            numero: '001',
            vencimento: data.parsed.data_emissao,
            valor: data.parsed.valor_total,
          }];
      setParcelas(parcs);
      setStage('reviewing');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: NFeApiError } } })
        ?.response?.data?.detail;
      if (detail) {
        setErrorInfo(detail);
        if (detail.code !== 'DUPLICATE') {
          toast('error', detail.message || 'Erro ao processar XML');
        }
      } else {
        toast('error', 'Erro ao enviar XML');
      }
      setStage('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || stage === 'saving') return;
    setStage('saving');
    try {
      const payload: ImportNFePayload = {
        chave_acesso: preview.parsed.chave_acesso,
        fornecedor: preview.fornecedor
          ? {
              id: preview.fornecedor.id,
              nome: preview.fornecedor.nome,
              cnpj: preview.parsed.emitente_cnpj,
              email: preview.parsed.emitente_email,
            }
          : {
              id: null,
              nome: preview.parsed.emitente_fantasia || preview.parsed.emitente_nome,
              cnpj: preview.parsed.emitente_cnpj,
              email: preview.parsed.emitente_email,
            },
        descricao,
        categoria,
        observacoes,
        data_emissao: dataEmissao,
        parcelas: parcelas.map((p) => ({
          vencimento: p.vencimento,
          valor: p.valor,
        })),
      };
      await nfeService.import(payload);
      toast('success', `${parcelas.length} ${parcelas.length === 1 ? 'conta criada' : 'contas criadas'}!`);
      reset();
      onImported();
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: NFeApiError } } })
        ?.response?.data?.detail;
      if (detail?.code === 'DUPLICATE') {
        setErrorInfo(detail);
        setStage('error');
      } else {
        toast('error', detail?.message || 'Erro ao importar NF-e');
        setStage('reviewing');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <h2 className="text-[16px] font-semibold text-gray-900">Importar NF-e por XML</h2>
          <button onClick={handleClose} className="text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {stage === 'idle' && (
            <div className="p-5 space-y-3">
              <p className="text-[14px] text-gray-600">
                Selecione o XML da NF-e recebida do fornecedor.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="block w-full text-[15px] text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#1a2340] file:text-white file:font-medium hover:file:bg-[#243052] file:cursor-pointer"
              />
            </div>
          )}

          {stage === 'uploading' && (
            <div className="p-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <p className="text-[14px] text-gray-500">Processando XML...</p>
            </div>
          )}

          {stage === 'error' && errorInfo && (
            <div className="p-5 space-y-3">
              {errorInfo.code === 'DUPLICATE' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
                  <p className="text-[14px] font-semibold text-amber-800">NF-e já importada</p>
                  <p className="text-[13px] text-amber-700 mt-1">
                    Esta NF-e foi importada em {errorInfo.importada_em
                      ? new Date(errorInfo.importada_em + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'}.
                    {errorInfo.contas_pagar_ids && errorInfo.contas_pagar_ids.length > 0 && (
                      <> Já existem {errorInfo.contas_pagar_ids.length} conta(s) a pagar vinculada(s).</>
                    )}
                  </p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
                  <p className="text-[14px] font-semibold text-red-800">{errorInfo.code}</p>
                  <p className="text-[13px] text-red-700 mt-1">{errorInfo.message || 'Erro ao processar XML'}</p>
                </div>
              )}
              <button onClick={reset} className="text-[14px] text-blue-600 hover:underline">
                Tentar com outro XML
              </button>
            </div>
          )}

          {(stage === 'reviewing' || stage === 'saving') && preview && (
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              {!preview.fornecedor && (
                <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
                  <p className="text-[13px] text-blue-700 font-medium">
                    Novo fornecedor será cadastrado: {preview.parsed.emitente_fantasia || preview.parsed.emitente_nome} (CNPJ {preview.parsed.emitente_cnpj})
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Descrição <span className="text-red-400">*</span></label>
                <input
                  type="text" required value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Categoria <span className="text-red-400">*</span></label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300">
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Data emissão</label>
                  <input
                    type="date" value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[14px] font-medium text-gray-600">Parcelas</p>
                  <p className="text-[13px] text-gray-500">
                    Total: {formatCurrency(parcelas.reduce((s, p) => s + Number(p.valor || 0), 0))}
                  </p>
                </div>
                <div className="space-y-2">
                  {parcelas.map((p, i) => (
                    <div key={i} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                      <span className="text-[13px] text-gray-500 font-medium">#{p.numero}</span>
                      <input
                        type="date" required value={p.vencimento}
                        onChange={(e) => {
                          const n = [...parcelas];
                          n[i] = { ...n[i], vencimento: e.target.value };
                          setParcelas(n);
                        }}
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[14px] text-gray-700 focus:outline-none focus:border-gray-300"
                      />
                      <input
                        type="number" step="0.01" min="0" required value={p.valor}
                        onChange={(e) => {
                          const n = [...parcelas];
                          n[i] = { ...n[i], valor: e.target.value };
                          setParcelas(n);
                        }}
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[14px] text-gray-700 focus:outline-none focus:border-gray-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Observações</label>
                <textarea
                  rows={4} value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[14px] text-gray-700 focus:outline-none focus:border-gray-300 resize-none font-mono"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={handleClose}
                  className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={stage === 'saving'}
                  className="flex-1 bg-[#1a2340] text-white py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] disabled:opacity-50">
                  {stage === 'saving' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: zero erros.

### Task 5.2: Integrar na página ContasPagar

**Files:**
- Modify: `frontend/src/pages/ContasPagar.tsx`

- [ ] **Step 1: Adicionar import e estado**

No topo, após o import de `MonthNavigator`:

```typescript
import { ImportarNFEModal } from '../components/contas-pagar/ImportarNFEModal';
import { Upload } from 'lucide-react';
```

E adicionar `Upload` ao import existente do lucide-react (linha 2 atual). Versão final dos imports do lucide:

```typescript
import { Plus, Pencil, Trash2, X, Search, CheckCircle, RotateCcw, Upload } from 'lucide-react';
```

Dentro do componente, junto com os outros estados (após `editingItem`):

```typescript
const [showImportModal, setShowImportModal] = useState(false);
```

- [ ] **Step 2: Adicionar botão na header**

Localizar o bloco do botão "Nova Despesa" (linha ~191-194 do arquivo atual):

```tsx
<button onClick={openCreate} className="flex items-center gap-1.5 bg-[#1a2340] text-white px-3.5 py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors">
  <Plus size={14} /> Nova Despesa
</button>
```

Substituir por um wrapper `<div>` com 2 botões:

```tsx
<div className="flex items-center gap-2">
  <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3.5 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50 transition-colors">
    <Upload size={14} /> Importar XML
  </button>
  <button onClick={openCreate} className="flex items-center gap-1.5 bg-[#1a2340] text-white px-3.5 py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors">
    <Plus size={14} /> Nova Despesa
  </button>
</div>
```

- [ ] **Step 3: Adicionar render do modal no fim do JSX**

Antes do fechamento `</div>` final do componente (após o bloco do "Modal" existente, linha ~456 do arquivo atual), adicionar:

```tsx
<ImportarNFEModal
  isOpen={showImportModal}
  onClose={() => setShowImportModal(false)}
  onImported={() => { setIsLoading(true); load(); }}
/>
```

- [ ] **Step 4: Verificar typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Build**

```bash
cd frontend && npm run build
```

Esperado: build OK.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/contas-pagar/ImportarNFEModal.tsx frontend/src/pages/ContasPagar.tsx
git commit -m "feat(frontend): add Importar XML button + modal in ContasPagar"
```

---

## Fase 6 — Validação manual end-to-end

**Por quê:** A spec V1 não cobre testes E2E automatizados; validação visual com o XML real é o aceite final.

### Task 6.1: Subir backend e frontend localmente

- [ ] **Step 1: Aplicar migração no banco de dev (se ainda não aplicada na Fase 1)**

```bash
cd backend && venv/Scripts/alembic upgrade head
```

- [ ] **Step 2: Subir backend**

```bash
cd backend && venv/Scripts/uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 3: Subir frontend**

```bash
cd frontend && npm run dev
```

### Task 6.2: Testar fluxo feliz com XML real

- [ ] **Step 1: Login no app, abrir Contas a Pagar**

Abrir `http://localhost:5173/contas-pagar` (porta padrão do Vite — ajustar se diferente).

- [ ] **Step 2: Clicar em "Importar XML" e selecionar o arquivo do PWM**

Arquivo: `C:\Users\gabri\Downloads\42260417888968000107550010000154731674299207-procNFe.xml`.

- [ ] **Step 3: Validar o modal de revisão**

Esperado:
- Banner azul: "Novo fornecedor será cadastrado: PWM REGUAS DIGITAIS (CNPJ 17888968000107)" (na primeira execução).
- Descrição: "NF-e nº 15473 - PWM REGUAS DIGITAIS".
- Categoria: material.
- Data emissão: 27/04/2026.
- 1 parcela: #001, 18/05/2026, R$ 150,00.
- Observações com chave formatada e item "1x MOLA DE RETORNO ...".

- [ ] **Step 4: Salvar e validar lista**

Clicar em "Salvar". Esperar toast de sucesso. Validar que:
- A lista de Contas a Pagar mostra a nova conta.
- A descrição/valor/vencimento batem.
- Indo em Fornecedores, "PWM REGUAS DIGITAIS" aparece com o CNPJ correto.

### Task 6.3: Testar duplicidade

- [ ] **Step 1: Tentar importar o mesmo XML novamente**

Esperado: modal mostra banner amarelo "NF-e já importada em 27/04/2026. Já existe 1 conta(s) a pagar vinculada(s)."

- [ ] **Step 2: Botão "Tentar com outro XML" reseta o estado**

Clicar nele e validar que o input de arquivo volta a aparecer.

### Task 6.4: Testar erros do parser

- [ ] **Step 1: Importar `nfe_55_cancelada.xml`** (do diretório de fixtures, copiar para Downloads ou apontar pro path direto)

Esperado: erro vermelho com `NOT_AUTHORIZED`.

- [ ] **Step 2: Importar `nfc_e_modelo_65.xml`**

Esperado: erro vermelho com `UNSUPPORTED_MODEL`.

- [ ] **Step 3: Importar um arquivo .txt qualquer**

Esperado: erro vermelho com `INVALID_XML` ou validação do navegador (`accept=".xml"`).

### Task 6.5: Testar fluxo com 3 parcelas (sintético)

- [ ] **Step 1: Subir o XML `nfe_55_3_parcelas.xml`**

Esperado:
- Modal mostra 3 parcelas, 100,00 cada.
- Descrição: "NF-e nº 999 - FORNEC TESTE".
- Após salvar, lista mostra 3 contas com "Parcela 1/3", "2/3", "3/3" (vide formatação atual da página).
- Vão para o mesmo `grupo_parcelas_id` (se editar a primeira, opção de cascata deve aparecer no modal de edição padrão).

### Task 6.6: Reportar resultado

- [ ] **Step 1: Confirmar com o cliente**

Mostrar o fluxo end-to-end e coletar feedback. Documentar qualquer ajuste fino na descrição/observações.

- [ ] **Step 2: Commit final, se houver ajustes pequenos**

```bash
git add -A
git commit -m "fix(nfe): ajustes pós-validação manual"
```

---

## Self-review checklist

- [x] **Spec coverage:** modelo NotaFiscal (Fase 1), parser com defusedxml (Fase 2), endpoints preview/import com 409/413/400 (Fase 3), frontend modal + integração (Fases 4-5), validação manual (Fase 6).
- [x] **Erros do parser:** INVALID_XML, NOT_NFE, UNSUPPORTED_MODEL, NOT_AUTHORIZED, MISSING_FIELDS — todos cobertos por testes.
- [x] **Edge cases da spec:** sem `<cobr>` (Task 2.4 + frontend usa `data_emissao` como vencimento default), fornecedor existente por CNPJ (Task 3.4), nova criação (3.6), duplicidade preview e import (3.8), 1 MB (3.9).
- [x] **Sem placeholders:** todos os steps com código completo e comandos exatos.
- [x] **Type consistency:** `parse_nfe_xml`, `NFeParserError`, `NFeParsedData`, `preview_nfe`, `import_nfe`, `nfeService.preview/import` consistentes entre tasks.
- [x] **Segurança:** `defusedxml.ElementTree` (XXE-safe), limite 1MB, auth admin nos 2 endpoints.

---

## Observações para execução

- **Pequena divergência da spec:** spec lista as descrições de parcelas "todas iguais"; o plano adiciona `(i+1/N)` no final quando N>1, espelhando o comportamento do `create_conta_pagar` existente — isso mantém consistência com o resto do sistema. Se o cliente quiser que fiquem 100% iguais, remover o sufixo no Task 3.1.
- **Categorias:** lista fixa do schema atual (`servicos` sem ç). Frontend usa os mesmos slugs.
- **Banco de teste:** SQLite em memória via aiosqlite. UUIDs são armazenados como strings — funciona porque SQLAlchemy abstrai.
