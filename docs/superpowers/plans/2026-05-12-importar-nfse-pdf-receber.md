# Importar NFS-e PDF (Joinville) em Contas a Receber — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir importação de PDFs de NFS-e da Prefeitura de Joinville no fluxo de Contas a Receber, reaproveitando o modal e o pipeline da importação XML existente.

**Architecture:** Novo parser PDF (`nfse_joinville_pdf_parser.py`) produz o mesmo schema `NFeParsedData` que o parser XML; o endpoint `POST /contas-receber/preview-nfe` passa a aceitar XML ou PDF e despacha pro parser certo. O resto do pipeline (`import-nfe`, modal, dedup, criação de ContaReceber) não muda. Migration aumenta `chave_acesso` (44→50) e `modelo` (2→10) sem tocar dados existentes.

**Tech Stack:** FastAPI · SQLAlchemy 2 (async) · Alembic · Pydantic v2 · pdfplumber · pytest · React + TypeScript

**Reference spec:** [`docs/superpowers/specs/2026-05-12-importar-nfse-pdf-receber-design.md`](../specs/2026-05-12-importar-nfse-pdf-receber-design.md)

---

## Task 1: Dependências e fixture do PDF

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/fixtures/nfse/nfse_joinville_162.pdf` (copiado de `C:\Users\gabri\usinasoft-v2\Nota 162 serviço viqua.pdf`)

- [ ] **Step 1: Adicionar pdfplumber em requirements**

Editar `backend/requirements.txt` adicionando ao final:

```
pdfplumber==0.11.4
```

- [ ] **Step 2: Criar diretório de fixtures NFS-e e copiar PDF**

PowerShell (Windows):

```powershell
New-Item -ItemType Directory -Path "backend\tests\fixtures\nfse" -Force
Copy-Item "..\..\..\Nota 162 serviço viqua.pdf" "backend\tests\fixtures\nfse\nfse_joinville_162.pdf"
```

A origem é o root do repositório (3 níveis acima do worktree). Se o caminho relativo falhar, use o absoluto:

```powershell
Copy-Item "C:\Users\gabri\usinasoft-v2\Nota 162 serviço viqua.pdf" "backend\tests\fixtures\nfse\nfse_joinville_162.pdf"
```

- [ ] **Step 3: Instalar pdfplumber no venv backend**

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install pdfplumber==0.11.4
```

Expected: `Successfully installed pdfplumber-0.11.4 pdfminer.six-...`

- [ ] **Step 4: Verificar import**

```powershell
python -c "import pdfplumber; print(pdfplumber.__version__)"
```

Expected: `0.11.4`

- [ ] **Step 5: Verificar tamanho do fixture (sanity check)**

```powershell
Get-Item "tests\fixtures\nfse\nfse_joinville_162.pdf" | Select-Object Length
```

Expected: tamanho entre 50 KB e 500 KB (o PDF original é ~82 KB).

- [ ] **Step 6: Commit**

```powershell
git add backend/requirements.txt backend/tests/fixtures/nfse/nfse_joinville_162.pdf
git commit -m "chore(nfse): add pdfplumber dependency and Joinville PDF fixture"
```

---

## Task 2: Migration — expandir colunas de notas_fiscais

**Files:**
- Create: `backend/alembic/versions/c3d4e5f6a7b8_expand_nota_fiscal_columns.py`
- Modify: `backend/app/models/nota_fiscal.py:18,23`

- [ ] **Step 1: Verificar revision atual do alembic**

```powershell
cd backend
.\venv\Scripts\Activate.ps1
alembic current
```

Anote a revision atual (deve ser `f2c3d4e5a6b7` — `add_direcao_to_notas_fiscais`).

- [ ] **Step 2: Criar arquivo de migration**

Criar `backend/alembic/versions/c3d4e5f6a7b8_expand_nota_fiscal_columns.py` com:

```python
"""expand_nota_fiscal_columns

Aumenta chave_acesso (44→50) para acomodar chave nacional NFS-e
e modelo (2→10) para acomodar valores como "NFSE".

Operação non-destructive: ALTER COLUMN type para VARCHAR maior
no PostgreSQL é metadata only, dados existentes permanecem intactos.

Revision ID: c3d4e5f6a7b8
Revises: f2c3d4e5a6b7
Create Date: 2026-05-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'f2c3d4e5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'notas_fiscais', 'chave_acesso',
        type_=sa.String(length=50),
        existing_type=sa.String(length=44),
        existing_nullable=False,
    )
    op.alter_column(
        'notas_fiscais', 'modelo',
        type_=sa.String(length=10),
        existing_type=sa.String(length=2),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'notas_fiscais', 'modelo',
        type_=sa.String(length=2),
        existing_type=sa.String(length=10),
        existing_nullable=False,
    )
    op.alter_column(
        'notas_fiscais', 'chave_acesso',
        type_=sa.String(length=44),
        existing_type=sa.String(length=50),
        existing_nullable=False,
    )
```

- [ ] **Step 3: Atualizar o model SQLAlchemy**

Em `backend/app/models/nota_fiscal.py`, alterar as duas linhas:

```python
# linha ~18-20:
    chave_acesso: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
# linha ~23:
    modelo: Mapped[str] = mapped_column(String(10), nullable=False)
```

- [ ] **Step 4: Aplicar migration no banco local**

```powershell
alembic upgrade head
```

Expected: `Running upgrade f2c3d4e5a6b7 -> c3d4e5f6a7b8, expand_nota_fiscal_columns`

- [ ] **Step 5: Verificar que migration é reversível**

```powershell
alembic downgrade -1
alembic upgrade head
```

Expected: ambos rodam sem erro. Dados existentes permanecem.

- [ ] **Step 6: Rodar suite de testes existente para garantir zero regressão**

```powershell
pytest tests/test_import_nfe_receber.py tests/test_import_nfe.py tests/test_nfe_parser.py -v
```

Expected: todos os testes passam (a migration não muda comportamento, só tamanho de coluna).

- [ ] **Step 7: Commit**

```powershell
git add backend/alembic/versions/c3d4e5f6a7b8_expand_nota_fiscal_columns.py backend/app/models/nota_fiscal.py
git commit -m "feat(nfse): expand notas_fiscais.chave_acesso to 50 chars and modelo to 10"
```

---

## Task 3: Parser — funções puras de extração

Decompor o parser em funções puras testáveis sem PDF (regex, normalização) + um orquestrador que usa pdfplumber. Esta task cria as funções puras.

**Files:**
- Create: `backend/app/services/nfse_joinville_pdf_parser.py` (esqueleto + funções puras)
- Create: `backend/tests/test_nfse_joinville_parser.py`

- [ ] **Step 1: Escrever testes das funções puras (todos devem falhar)**

Criar `backend/tests/test_nfse_joinville_parser.py`:

```python
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
```

- [ ] **Step 2: Criar esqueleto do módulo e rodar os testes (devem falhar)**

Criar `backend/app/services/nfse_joinville_pdf_parser.py`:

```python
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


def _normalize_cnpj(value: str) -> str:
    raise NotImplementedError


def _parse_numero_serie(text: str) -> tuple[str, str]:
    raise NotImplementedError


def _parse_data_emissao(text: str) -> date:
    raise NotImplementedError


def _parse_valor_brl(text: str) -> Decimal:
    raise NotImplementedError


def _parse_vencimentos(text: str, valor_total: Decimal) -> list[NFeParcelaParsed]:
    raise NotImplementedError


def parse_nfse_joinville_pdf(pdf_bytes: bytes) -> NFeParsedData:
    raise NotImplementedError
```

```powershell
pytest tests/test_nfse_joinville_parser.py -v
```

Expected: todos os testes falham com `NotImplementedError`.

- [ ] **Step 3: Implementar `_normalize_cnpj`**

```python
def _normalize_cnpj(value: str) -> str:
    return re.sub(r"[^0-9]", "", value or "")
```

- [ ] **Step 4: Implementar `_parse_numero_serie`**

```python
_NUMERO_SERIE_RE = re.compile(r"\b(\d{8,})\s*/\s*([A-Za-z0-9]+)\b")


def _parse_numero_serie(text: str) -> tuple[str, str]:
    m = _NUMERO_SERIE_RE.search(text)
    if not m:
        raise NFeParserError("MISSING_FIELDS", "Número/Série da nota não encontrado no PDF")
    numero = m.group(1).lstrip("0") or "0"
    serie = m.group(2)
    return numero, serie
```

- [ ] **Step 5: Implementar `_parse_data_emissao`**

```python
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
```

- [ ] **Step 6: Implementar `_parse_valor_brl`**

```python
_VALOR_LIQUIDO_RE = re.compile(
    r"Valor\s+líquido\s+da\s+NFS-e[^\d]*([\d.]+,\d{2})",
    re.IGNORECASE | re.DOTALL,
)
_VALOR_BRL_FALLBACK_RE = re.compile(r"VALOR\s+TOTAL\s+DO\s+SERVIÇO[^\d]*R?\$?\s*([\d.]+,\d{2})", re.IGNORECASE)


def _parse_valor_brl(text: str) -> Decimal:
    m = _VALOR_LIQUIDO_RE.search(text) or _VALOR_BRL_FALLBACK_RE.search(text)
    if not m:
        raise NFeParserError("MISSING_FIELDS", "Valor da nota não encontrado no PDF")
    raw = m.group(1).replace(".", "").replace(",", ".")
    return Decimal(raw)
```

- [ ] **Step 7: Implementar `_parse_vencimentos`**

```python
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
```

- [ ] **Step 8: Rodar testes das funções puras**

```powershell
pytest tests/test_nfse_joinville_parser.py -v
```

Expected: todos os 17 testes passam.

- [ ] **Step 9: Commit**

```powershell
git add backend/app/services/nfse_joinville_pdf_parser.py backend/tests/test_nfse_joinville_parser.py
git commit -m "feat(nfse): add pure parser helpers for Joinville NFS-e PDF text"
```

---

## Task 4: Parser — extração de PDF e orquestrador

Esta task adiciona as funções que dependem do `pdfplumber` (column split + orquestrador) e usa a fixture real do PDF para testar o caminho completo.

**Files:**
- Modify: `backend/app/services/nfse_joinville_pdf_parser.py` — adicionar `_extract_pdf_sections` e `parse_nfse_joinville_pdf`
- Modify: `backend/tests/test_nfse_joinville_parser.py` — testes de integração com a fixture

- [ ] **Step 1: Adicionar testes de integração com a fixture**

Adicionar ao final de `backend/tests/test_nfse_joinville_parser.py`:

```python
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
    import pdfplumber
    import io

    # Construir um PDF minimal usando pdfplumber não dá — vamos gerar um bytes
    # de um PDF válido vazio. Mais simples: usar um PDF com texto diferente.
    # Como não temos outro PDF de teste, criar um inline com reportlab seria overkill.
    # Solução: gerar via pdfplumber.utils ou usar bytes de PDF mínimo conhecido.

    # PDF minimal de 1 página com texto "Hello" (gerado offline e codificado em base64
    # seria opcional; aqui usamos um truque: pdfplumber abre, mas o texto não bate)
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
    # Pode falhar como INVALID_PDF (se pdfplumber rejeitar) ou NOT_NFSE_JOINVILLE
    assert exc.value.code in ("INVALID_PDF", "NOT_NFSE_JOINVILLE")
```

Adicionar `from pathlib import Path` no topo (já está importado para outros usos? Confirmar).

- [ ] **Step 2: Rodar testes (devem falhar)**

```powershell
pytest tests/test_nfse_joinville_parser.py::test_parse_pdf_real_162 -v
```

Expected: FAIL com `NotImplementedError` (orquestrador ainda vazio).

- [ ] **Step 3: Implementar extração de seções e orquestrador**

Substituir o stub `parse_nfse_joinville_pdf` no final de `nfse_joinville_pdf_parser.py`:

```python
import io
from dataclasses import dataclass

import pdfplumber


JOINVILLE_SIGNATURE = "Nota Fiscal Eletrônica de Serviços Municipais"


@dataclass
class _PdfSections:
    full_text: str            # texto completo da primeira página
    prestador_text: str       # coluna esquerda do bloco PRESTADOR
    tomador_text: str         # coluna direita do bloco TOMADOR
    discriminacao_text: str   # bloco entre DISCRIMINAÇÃO e VALOR TOTAL
    chave_50: Optional[str]   # chave nacional 50 dígitos


def _find_label_y(page, label: str) -> Optional[float]:
    """Retorna a coordenada 'top' da primeira palavra que contém o label, ou None."""
    words = page.extract_words()
    for w in words:
        if label.lower() in w["text"].lower():
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

        if JOINVILLE_SIGNATURE.lower() not in full_text.lower():
            raise NFeParserError(
                "NOT_NFSE_JOINVILLE",
                "Este PDF não parece ser uma NFS-e da Prefeitura de Joinville",
            )

        # Encontrar âncoras verticais para crop dos blocos PRESTADOR/TOMADOR
        # e DISCRIMINAÇÃO.
        # Anchor superior: linha "PRESTADOR DE SERVIÇOS" (ou TOMADOR — mesma linha)
        y_prestador = _find_label_y(page, "PRESTADOR")
        y_discriminacao = _find_label_y(page, "DISCRIMINAÇÃO")
        y_valor_total = _find_label_y(page, "VALOR TOTAL DO SERVIÇO")

        prestador_text = ""
        tomador_text = ""
        if y_prestador is not None and y_discriminacao is not None:
            mid_x = page.width / 2
            top = y_prestador + 5  # logo abaixo do header
            bottom = y_discriminacao - 2
            left_crop = page.within_bbox((0, top, mid_x, bottom))
            right_crop = page.within_bbox((mid_x, top, page.width, bottom))
            prestador_text = left_crop.extract_text() or ""
            tomador_text = right_crop.extract_text() or ""

        discriminacao_text = ""
        if y_discriminacao is not None and y_valor_total is not None:
            top = y_discriminacao + 2
            bottom = y_valor_total - 2
            block = page.within_bbox((0, top, page.width, bottom))
            discriminacao_text = block.extract_text() or ""

        # Chave nacional NFS-e (50 dígitos) aparece no rodapé do texto completo
        chave_m = re.search(r"\b(\d{50})\b", full_text)
        chave_50 = chave_m.group(1) if chave_m else None

        return _PdfSections(
            full_text=full_text,
            prestador_text=prestador_text,
            tomador_text=tomador_text,
            discriminacao_text=discriminacao_text,
            chave_50=chave_50,
        )
    finally:
        pdf.close()


_LABEL_RE_CACHE: dict[str, re.Pattern] = {}


def _extract_label(text: str, label: str) -> Optional[str]:
    """Pega o valor à direita de 'Label:' no texto (multilinha).

    Captura tudo até a próxima quebra de linha ou o próximo label conhecido.
    """
    pattern = _LABEL_RE_CACHE.get(label)
    if pattern is None:
        # Captura até newline OU até próximo label (palavra seguida de ':')
        pattern = re.compile(
            rf"{re.escape(label)}\s*:?\s*([^\n]*?)(?=\n|$)",
            re.IGNORECASE,
        )
        _LABEL_RE_CACHE[label] = pattern
    m = pattern.search(text)
    if not m:
        return None
    value = m.group(1).strip()
    return value or None


def parse_nfse_joinville_pdf(pdf_bytes: bytes) -> NFeParsedData:
    sections = _extract_pdf_sections(pdf_bytes)

    # Campos do cabeçalho/rodapé — vêm do texto completo
    numero, serie = _parse_numero_serie(sections.full_text)
    data_emissao = _parse_data_emissao(sections.full_text)
    valor_total = _parse_valor_brl(sections.full_text)

    # Chave nacional
    chave = sections.chave_50
    if not chave:
        raise NFeParserError("MISSING_FIELDS", "Chave de acesso (50 dígitos) não encontrada no PDF")

    # PRESTADOR (emitente)
    emit_cnpj_raw = _extract_label(sections.prestador_text, "CPF/CNPJ")
    if not emit_cnpj_raw:
        raise NFeParserError("MISSING_FIELDS", "CNPJ do prestador não encontrado no PDF")
    emit_cnpj = _normalize_cnpj(emit_cnpj_raw.split()[0] if emit_cnpj_raw else "")
    if len(emit_cnpj) not in (11, 14):
        raise NFeParserError("MISSING_FIELDS", "CNPJ/CPF do prestador inválido")

    emit_nome = (
        _extract_label(sections.prestador_text, "Nome empresarial")
        or _extract_label(sections.prestador_text, "Nome")
        or ""
    )
    emit_fantasia = _extract_label(sections.prestador_text, "Nome fantasia")

    # TOMADOR (destinatário)
    dest_cnpj_raw = _extract_label(sections.tomador_text, "CPF/CNPJ")
    dest_cnpj = _normalize_cnpj(dest_cnpj_raw.split()[0]) if dest_cnpj_raw else None
    if dest_cnpj and len(dest_cnpj) not in (11, 14):
        dest_cnpj = None
    dest_nome = (
        _extract_label(sections.tomador_text, "Nome")
        or _extract_label(sections.tomador_text, "Nome empresarial")
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
```

- [ ] **Step 4: Rodar todos os testes do parser**

```powershell
pytest tests/test_nfse_joinville_parser.py -v
```

Expected: todos os ~20 testes passam, incluindo `test_parse_pdf_real_162`. Se algum falhar:
- Ler o assertion error e ajustar a regex/posicionamento conforme o que o pdfplumber realmente extrai
- Pode ser necessário rodar um script de debug: `python -c "import pdfplumber; p = pdfplumber.open('tests/fixtures/nfse/nfse_joinville_162.pdf'); print(p.pages[0].extract_text())"` pra ver o texto real

- [ ] **Step 5: Iteração — caso `test_parse_pdf_real_162` falhe**

A regex/posicionamento exato pode precisar de pequenos ajustes baseados no que `pdfplumber.extract_text()` retorna pro PDF específico (espaçamento, ordem das palavras). Não mudar o contrato externo dos campos; ajustar apenas:
- `JOINVILLE_SIGNATURE` (talvez "NF-em" ou "Serviços Municipais" funcione melhor)
- âncoras de labels em `_find_label_y` (pode precisar combinar palavras adjacentes)
- regex de valor (talvez precise normalizar espaços/quebras de linha)

Iterar até passar.

- [ ] **Step 6: Commit**

```powershell
git add backend/app/services/nfse_joinville_pdf_parser.py backend/tests/test_nfse_joinville_parser.py
git commit -m "feat(nfse): full Joinville NFS-e PDF parser with column splitting"
```

---

## Task 5: Service e route — aceitar PDF no preview

**Files:**
- Modify: `backend/app/services/nota_fiscal_service.py:173-214` (função `preview_nfe_receber`)
- Modify: `backend/app/api/routes/contas_receber.py:57-78` (endpoint `preview_nfe_receber_route`)
- Modify: `backend/tests/test_import_nfe_receber.py` — adicionar testes PDF

- [ ] **Step 1: Adicionar testes de integração no endpoint (devem falhar)**

Adicionar ao final de `backend/tests/test_import_nfe_receber.py`:

```python
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
    result = await db_session.execute(
        select(ContaReceber).where(ContaReceber.id == body["contas_receber_ids"][0])
    )
    conta = result.scalar_one()
    assert float(conta.valor) == 10776.00

    # 4) NotaFiscal registrada com chave de 50 chars
    result = await db_session.execute(
        select(NotaFiscal).where(NotaFiscal.id == body["nota_fiscal_id"])
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
```

- [ ] **Step 2: Rodar testes (devem falhar — endpoint ainda só aceita XML)**

```powershell
pytest tests/test_import_nfe_receber.py::test_preview_nfse_pdf_ok -v
```

Expected: FAIL com 400 INVALID_CONTENT_TYPE (rejeita PDF).

- [ ] **Step 3: Atualizar `preview_nfe_receber` no service**

Em `backend/app/services/nota_fiscal_service.py`, modificar a função (linhas 173-214):

```python
async def preview_nfe_receber(
    db: AsyncSession, content: bytes, is_pdf: bool = False
) -> PreviewNFeReceberResponse:
    if is_pdf:
        from app.services.nfse_joinville_pdf_parser import (
            parse_nfse_joinville_pdf,
            NFeParserError as PdfParserError,
        )
        try:
            parsed = parse_nfse_joinville_pdf(content)
        except PdfParserError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": e.code, "message": e.message},
            )
    else:
        parsed = _parse_or_400(content)

    empresa = _empresa_cnpj()
    if parsed.emitente_cnpj != empresa:
        _raise_wrong_direction("receber", parsed)

    if not parsed.dest_cnpj_cpf:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "MISSING_DEST",
                "message": "Esta nota não tem CNPJ/CPF de destinatário.",
            },
        )

    existing = await _find_existing_nota(db, parsed.chave_acesso)
    if existing:
        contas_ids = await _find_contas_receber_by_grupo(db, existing.grupo_parcelas_id)
        _raise_duplicate(existing, contas_ids)

    cliente_link = None
    cli_result = await db.execute(
        select(Cliente).where(Cliente.cnpj_cpf == parsed.dest_cnpj_cpf)
    )
    cli = cli_result.scalar_one_or_none()
    if cli:
        cliente_link = FornecedorVinculado(id=cli.id, nome=cli.nome)

    nome_dest = parsed.dest_nome or "Cliente"
    rotulo = "NFS-e" if parsed.modelo == "NFSE" else "NF-e"
    sugestoes = PreviewSugestoesReceber(
        descricao=f"{rotulo} nº {parsed.numero_nota} - {nome_dest}",
        observacoes=_format_observacoes(parsed),
    )

    return PreviewNFeReceberResponse(
        parsed=parsed,
        cliente=cliente_link,
        sugestoes=sugestoes,
    )
```

Mudanças: parâmetro `is_pdf` (default `False`), branch que chama o parser PDF, e prefixo "NFS-e" vs "NF-e" na descrição sugerida.

- [ ] **Step 4: Ajustar `_format_observacoes` para NFS-e (sem itens)**

`_format_observacoes` itera sobre `parsed.itens`. Para NFS-e, `itens` é vazio — o método já lida bem mas a saída fica "Itens:" sem nada. Ajustar para não imprimir o cabeçalho se vazio:

Em `nota_fiscal_service.py` (linhas ~67-76):

```python
def _format_observacoes(parsed: NFeParsedData) -> str:
    linhas = [f"Chave: {_format_chave(parsed.chave_acesso)}"]
    if parsed.itens:
        linhas.append("Itens:")
        for it in parsed.itens:
            qtd_str = f"{it.quantidade.normalize():f}"
            if "." in qtd_str:
                qtd_str = qtd_str.rstrip("0").rstrip(".")
            linhas.append(
                f"- {qtd_str}x {it.descricao} (R$ {it.valor_total:.2f})"
            )
    return "\n".join(linhas)
```

- [ ] **Step 5: Atualizar `_format_chave` para suportar 50 chars**

`_format_chave` quebra em grupos de 4. Funciona para 44 e 50 — não precisa mudar. Apenas verificar.

- [ ] **Step 6: Atualizar endpoint route**

Em `backend/app/api/routes/contas_receber.py`, substituir a função `preview_nfe_receber_route` (linhas ~57-78) e o constante `MAX_XML_SIZE` (linha 28):

```python
MAX_XML_SIZE = 1 * 1024 * 1024  # 1 MB
MAX_PDF_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_MIMES_XML = ("text/xml", "application/xml", "application/octet-stream")
ALLOWED_MIMES_PDF = ("application/pdf",)


@router.post("/preview-nfe", response_model=PreviewNFeReceberResponse)
async def preview_nfe_receber_route(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_admin_user),
) -> PreviewNFeReceberResponse:
    filename = (file.filename or "").lower()
    is_pdf = filename.endswith(".pdf") or file.content_type == "application/pdf"

    if is_pdf:
        if file.content_type and file.content_type not in ALLOWED_MIMES_PDF:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_CONTENT_TYPE", "message": "Envie um arquivo PDF"},
            )
        max_size = MAX_PDF_SIZE
    else:
        if file.content_type and file.content_type not in ALLOWED_MIMES_XML:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_CONTENT_TYPE", "message": "Envie XML ou PDF"},
            )
        max_size = MAX_XML_SIZE

    content = await file.read(max_size + 1)
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"Arquivo maior que {max_size // (1024*1024)} MB",
            },
        )

    return await preview_nfe_receber(db, content, is_pdf=is_pdf)
```

- [ ] **Step 7: Rodar testes do receber (XML + PDF)**

```powershell
pytest tests/test_import_nfe_receber.py -v
```

Expected: todos passam — os testes XML antigos continuam OK (parâmetro `is_pdf` tem default `False`), e os novos PDF passam.

- [ ] **Step 8: Rodar testes do pagar para checar não regressão**

```powershell
pytest tests/test_import_nfe.py -v
```

Expected: todos passam (pagar não foi tocado).

- [ ] **Step 9: Commit**

```powershell
git add backend/app/services/nota_fiscal_service.py backend/app/api/routes/contas_receber.py backend/tests/test_import_nfe_receber.py
git commit -m "feat(nfse): accept PDF in preview-nfe endpoint of contas-receber"
```

---

## Task 6: Frontend — modal aceita PDF + chip NFS-e

**Files:**
- Modify: `frontend/src/components/contas-receber/ImportarNFEReceberModal.tsx`
- Modify: `frontend/src/pages/ContasReceber.tsx:180`

- [ ] **Step 1: Atualizar accept e textos do modal**

Em `ImportarNFEReceberModal.tsx`:

- **Linha 147** (título do modal): trocar "Importar NF-e por XML" por "Importar Nota Fiscal":

```tsx
<h2 className="text-[16px] font-semibold text-gray-900">Importar Nota Fiscal</h2>
```

- **Linha 154-156** (instrução): trocar texto:

```tsx
<p className="text-[14px] text-gray-600">
  Selecione o XML da NF-e ou o PDF da NFS-e emitida pela sua empresa.
</p>
```

- **Linha 160** (input accept): expandir para PDF:

```tsx
accept=".xml,.pdf,application/xml,text/xml,application/pdf"
```

- **Linha 173** (stage uploading): texto genérico:

```tsx
<p className="text-[14px] text-gray-500">Processando arquivo...</p>
```

- [ ] **Step 2: Validação client-side de tamanho do PDF**

Adicionar antes da chamada `await nfeService.previewReceber(file)` (linha ~60 dentro de `handleFile`):

```tsx
const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
const maxBytes = isPdf ? 5 * 1024 * 1024 : 1 * 1024 * 1024;
if (file.size > maxBytes) {
  toast('error', `Arquivo maior que ${maxBytes / (1024 * 1024)} MB`);
  setStage('idle');
  return;
}
```

- [ ] **Step 3: Adicionar chip "NFS-e" / "NF-e" no preview**

Logo após o `<form onSubmit={handleSubmit} ...>` (linha ~209), antes do `{!preview.cliente && (...)}` (linha ~210), adicionar:

```tsx
<div className="flex items-center gap-2">
  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${
    preview.parsed.modelo === 'NFSE'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800'
  }`}>
    {preview.parsed.modelo === 'NFSE' ? 'NFS-e' : 'NF-e'}
  </span>
  <span className="text-[13px] text-gray-500">
    Nº {preview.parsed.numero_nota}
    {preview.parsed.serie ? ` · Série ${preview.parsed.serie}` : ''}
  </span>
</div>
```

- [ ] **Step 4: Ajustar mensagens de erro genéricas no modal**

Em `handleFile` (linha ~85-88), trocar "XML" por "arquivo":

```tsx
toast('error', detail.message || 'Erro ao processar arquivo');
// ...
toast('error', 'Erro ao enviar arquivo');
```

E na linha ~199 (mensagem de erro genérico):

```tsx
<p className="text-[13px] text-red-700 mt-1">{errorInfo.message || 'Erro ao processar arquivo'}</p>
```

- [ ] **Step 5: Atualizar label do botão na página**

Em `frontend/src/pages/ContasReceber.tsx` linha ~180:

```tsx
<Upload size={14} /> Importar Nota
```

- [ ] **Step 6: Build e type-check**

```powershell
cd frontend
npm run build
```

Expected: build passa sem erros TypeScript.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/components/contas-receber/ImportarNFEReceberModal.tsx frontend/src/pages/ContasReceber.tsx
git commit -m "feat(nfse): accept PDF in receber import modal and show note type chip"
```

---

## Task 7: Smoke test manual

**Files:** nenhum (só verificação)

- [ ] **Step 1: Subir backend e frontend em dev**

Terminal 1 (backend):

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (frontend):

```powershell
cd frontend
npm run dev
```

- [ ] **Step 2: Fazer login como admin na app**

Abrir o navegador no host do dev server (geralmente `http://localhost:5173`), logar com usuário admin.

- [ ] **Step 3: Importar o PDF**

1. Ir em "Contas a Receber"
2. Clicar em "Importar Nota"
3. Selecionar o arquivo `C:\Users\gabri\usinasoft-v2\Nota 162 serviço viqua.pdf`
4. Aguardar processamento

**Verificações:**
- [ ] Modal abre em modo "review"
- [ ] Chip "NFS-e" aparece (cor roxa)
- [ ] Número "162" aparece ao lado do chip
- [ ] Descrição sugerida: "NFS-e nº 162 - VÍQUA INDÚSTRIA DE PLÁSTICOS LTDA"
- [ ] Cliente: caixa azul "Novo cliente será cadastrado: VÍQUA..." (se Víqua ainda não existe) ou linkado se existe
- [ ] Data emissão: 12/05/2026
- [ ] 1 parcela com vencimento 02/06/2026 e valor R$ 10.776,00
- [ ] Observações com a chave nacional formatada em grupos de 4

- [ ] **Step 4: Confirmar import**

1. Clicar em "Salvar"
2. Verificar toast de sucesso "1 conta criada!"
3. Verificar que a conta aparece na lista
4. Verificar no banco (ou em /clientes) que Víqua foi cadastrada

- [ ] **Step 5: Testar dedup**

1. Abrir novamente "Importar Nota"
2. Selecionar o mesmo PDF
3. Verificar que aparece o aviso amarelo "NF-e já importada" com referência à conta existente

- [ ] **Step 6: Testar fluxo XML não regrediu**

1. Importar um XML em Contas a Receber (qualquer XML que já funcionava antes)
2. Verificar que chip "NF-e" (azul) aparece em vez de NFS-e
3. Confirmar que o fluxo termina com sucesso

---

## Critérios de aceitação finais

Conferir contra o spec (`docs/superpowers/specs/2026-05-12-importar-nfse-pdf-receber-design.md`):

1. ✅ Dono faz upload do PDF "Nota 162 viqua" no modal de Contas a Receber
2. ✅ Sistema extrai: prestador, tomador, valor, número, data, vencimento
3. ✅ Modal abre em modo "review" com tudo pré-preenchido, chip "NFS-e" visível
4. ✅ Confirmação cria `ContaReceber` vinculada ao cliente e registra `NotaFiscal` com chave de 50 dígitos
5. ✅ Re-importar o mesmo PDF retorna `DUPLICATE`
6. ✅ Importar PDF onde o prestador não é a LSC retorna `WRONG_DIRECTION` (testado em `_raise_wrong_direction`)
7. ✅ Notas já existentes (NF-e XML, chave 44) seguem funcionando — verificado em Task 2 step 6 e Task 5 step 7-8
