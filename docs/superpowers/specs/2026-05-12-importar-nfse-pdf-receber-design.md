# Importar NFS-e PDF (Joinville) em Contas a Receber — Design

**Data:** 2026-05-12
**Status:** Aprovado (aguardando revisão final do usuário)

## Contexto

O sistema já permite importar NF-e XML (mercadorias, modelo 55) em Contas a Pagar e Contas a Receber. Para Contas a Receber, o dono da empresa (LSC USINAGEM) emite notas pelo sistema da Prefeitura de Joinville e baixa apenas o PDF — não tem acesso ao XML. Hoje precisa cadastrar manualmente cada nota como conta a receber.

Esta feature adiciona importação por **PDF** no fluxo de Contas a Receber, extraindo automaticamente os campos da NFS-e municipal de Joinville e reaproveitando o modal/UX já existente.

### Escopo

- Importar PDF de NFS-e da Prefeitura de Joinville no fluxo de Contas a Receber
- Pré-preencher campos e parcelas; usuário revisa e confirma no modal existente
- Dedup contra notas já importadas (mesma chave nacional)
- Validar direção (prestador deve ser a própria empresa)

### Fora de escopo

- Importação de NFS-e de outras prefeituras (layouts diferentes)
- OCR de PDFs escaneados/fotografados
- Importação de NFS-e em Contas a Pagar (caso de uso não solicitado pelo dono)
- Armazenar o PDF original (segue o padrão XML que não armazena o arquivo)

## Decisões de design (pré-aprovadas com o usuário)

1. **Layout único:** sempre NFS-e municipal da Prefeitura de Joinville
2. **Parcelas:** maioria 1 parcela; podem aparecer múltiplas como "vencimentos: 02/06, 02/07, 02/08" no texto livre
3. **Origem do PDF:** baixado direto do portal de Joinville → texto extraível (sem OCR)
4. **Fallback de extração:** modal preenche campos extraídos; usuário completa os que faltarem (mesmo padrão XML)
5. **Abordagem:** reaproveitar pipeline existente — parser PDF produz o mesmo `NFeParsedData` que o parser XML

## Arquitetura

### Pipeline unificado

```
[Frontend Modal]
      │ POST /contas-receber/preview-nfe (multipart, XML ou PDF)
      ▼
[Route handler]
      │ detecta XML vs PDF por extensão/MIME
      ▼
[preview_nfe_receber(db, content, is_pdf)]
      │
      ├─ is_pdf=True  → parse_nfse_joinville_pdf(content) ──┐
      │                                                     │
      └─ is_pdf=False → parse_nfe_xml(content) ─────────────┤
                                                            ▼
                                                   NFeParsedData (mesmo schema)
                                                            │
                                                            ▼
                          WRONG_DIRECTION check + DUPLICATE check + sugestões
                                                            │
                                                            ▼
                                          PreviewNFeReceberResponse (mesmo contrato)
```

`POST /contas-receber/import-nfe` **não muda** — recebe JSON estruturado, agnóstico de origem.

### Arquivos afetados

**Novos:**
- `backend/app/services/nfse_joinville_pdf_parser.py` — parser principal
- `backend/alembic/versions/<new>_expand_nota_fiscal_columns.py` — migration
- `backend/tests/fixtures/nfse/nfse_joinville_162.pdf` — fixture do exemplo real (anonimizado se necessário)
- `backend/tests/fixtures/nfse/nfse_joinville_sintetico_multi_parcelas.pdf` — fixture construído para testar múltiplas parcelas
- `backend/tests/test_nfse_joinville_parser.py` — testes do parser puro

**Modificados:**
- `backend/app/api/routes/contas_receber.py` — endpoint aceita PDF
- `backend/app/services/nota_fiscal_service.py` — `preview_nfe_receber` ganha parâmetro `is_pdf`
- `backend/requirements.txt` — adicionar `pdfplumber`
- `backend/tests/test_import_nfe_receber.py` — adicionar casos PDF
- `frontend/src/components/contas-receber/ImportarNFEReceberModal.tsx` — `accept=".xml,.pdf"` + chip "NFS-e"
- `frontend/src/pages/ContasReceberPage.tsx` — label do botão "Importar XML" → "Importar Nota"

## Parser Joinville PDF — detalhes

### Biblioteca

`pdfplumber` (puxa `pdfminer.six` como transitiva). Já amplamente usada para extração de texto + posicional em PDFs.

### Estratégia

1. **Validação inicial:** abrir o PDF; se falhar, `INVALID_PDF`
2. **Detecção de layout:** procurar a string `"Nota Fiscal Eletrônica de Serviços Municipais"` no texto da primeira página; se ausente, `NOT_NFSE_JOINVILLE`
3. **Extração por seção:**
   - Para campos do cabeçalho e rodapé (chave nacional, número/série, data, valor): regex sobre `page.extract_text()`
   - Para PRESTADOR/TOMADOR (duas colunas): usar `page.extract_words()` com bounding boxes; dividir pela coordenada X média da largura da página; processar cada coluna separadamente como pares "Label: valor"
   - Para discriminação: pegar o bloco de texto entre os marcadores "DISCRIMINAÇÃO DOS SERVIÇOS" e "VALOR TOTAL DO SERVIÇO" (ou similar)

### Mapeamento de campos

| Campo `NFeParsedData` | Fonte no PDF | Estratégia |
|---|---|---|
| `modelo` | — | Fixo: `"NFSE"` |
| `chave_acesso` | rodapé "chave de acesso XXXX..." | Regex `\b\d{50}\b` no texto inteiro |
| `numero_nota` | topo "00000000162 / A1" | Regex `(\d{8,})\s*/\s*[A-Z0-9]+`, grupo 1 |
| `serie` | mesma fonte | Mesma regex, captura "A1" depois da barra |
| `data_emissao` | "Data e Hora da Emissão" | Parse `dd/mm/yyyy hh:mm:ss` → date |
| `valor_total` | linha "Valor líquido da NFS-e" | Regex `R?\$?\s*([\d.]+,\d{2})`, converter pt-BR → Decimal |
| `emitente_cnpj` | bloco esquerdo (PRESTADOR) → "CPF/CNPJ:" | Captura, remove `.`/`/`/`-` |
| `emitente_nome` | bloco esquerdo → "Nome empresarial:" | Trim |
| `emitente_fantasia` | bloco esquerdo → "Nome fantasia:" | Trim; pode ser vazio |
| `emitente_email` | — | `None` (não há no layout) |
| `dest_cnpj_cpf` | bloco direito (TOMADOR) → "CPF/CNPJ:" | Captura, remove pontuação |
| `dest_nome` | bloco direito → "Nome:" | Trim |
| `dest_email` | — | `None` |
| `parcelas` | discriminação (texto livre) | Ver "Vencimentos" abaixo |
| `itens` | — | `[]` (NFS-e não tem itens estruturados) |

### Vencimentos (parsing de texto livre)

Cascata de regex sobre o bloco da discriminação (case-insensitive):

1. **Múltiplas datas:** `vencimentos?\s*:?\s*((?:\d{1,2}/\d{1,2}(?:/\d{2,4})?(?:\s*[,;/]\s*|\s+)){1,}\d{1,2}/\d{1,2}(?:/\d{2,4})?)` → extrai a lista, faz split por `,`/`;`/espaço, parse data a data
2. **Data única:** `venc(?:imento)?\s*(?:dia)?\s*:?\s*(\d{1,2}/\d{1,2}/\d{2,4})` → uma só

Anos de 2 dígitos → `20XX` (ex.: "26" → 2026; assume-se contexto comercial de notas recentes).

Cada data vira `NFeParcelaParsed`:
- `numero` = sequencial zero-padded ("001", "002", ...)
- `vencimento` = data extraída
- `valor` = `valor_total / n_parcelas` (divisão exata; resto vai pra primeira/última parcela se necessário — mesma lógica já usada no XML)

Se **nenhuma** data for encontrada → `parcelas = []`. O modal frontend já trata isso preenchendo 1 parcela com vencimento = data de emissão.

### Erros

Códigos de erro emitidos pelo parser (todos viram `HTTPException 400` com `{code, message}`):

- `INVALID_PDF` — "Não foi possível ler o PDF"
- `NOT_NFSE_JOINVILLE` — "Este PDF não parece ser uma NFS-e da Prefeitura de Joinville"
- `MISSING_FIELDS` — "Não foi possível identificar [campo] no PDF" (apenas para campos críticos: CNPJ do prestador e valor total; demais ficam vazios)

`WRONG_DIRECTION` e `DUPLICATE` reaproveitam a lógica de `nota_fiscal_service.py` — funcionam idêntico porque o `NFeParsedData` tem os mesmos campos.

## Roteamento de endpoint

`POST /contas-receber/preview-nfe` aceita XML **ou** PDF. Decisão por extensão do filename ou MIME type:

```python
MAX_XML_SIZE = 1 * 1024 * 1024   # 1 MB
MAX_PDF_SIZE = 5 * 1024 * 1024   # 5 MB

ALLOWED_MIMES_PDF = ("application/pdf",)
ALLOWED_MIMES_XML = ("text/xml", "application/xml", "application/octet-stream")

@router.post("/preview-nfe", response_model=PreviewNFeReceberResponse)
async def preview_nfe_receber_route(file: UploadFile = File(...), db=..., _=...):
    filename = (file.filename or "").lower()
    is_pdf = filename.endswith(".pdf") or file.content_type == "application/pdf"

    if is_pdf:
        if file.content_type and file.content_type not in ALLOWED_MIMES_PDF:
            raise HTTPException(400, {"code": "INVALID_CONTENT_TYPE", "message": "Envie um arquivo PDF"})
        max_size = MAX_PDF_SIZE
    else:
        if file.content_type and file.content_type not in ALLOWED_MIMES_XML:
            raise HTTPException(400, {"code": "INVALID_CONTENT_TYPE", "message": "Envie um arquivo XML ou PDF"})
        max_size = MAX_XML_SIZE

    content = await file.read(max_size + 1)
    if len(content) > max_size:
        raise HTTPException(413, {"code": "FILE_TOO_LARGE", "message": f"Arquivo maior que {max_size // (1024*1024)} MB"})

    return await preview_nfe_receber(db, content, is_pdf=is_pdf)
```

`preview_nfe_receber(db, content, is_pdf)` no service:

```python
async def preview_nfe_receber(db, content, is_pdf=False):
    if is_pdf:
        try:
            parsed = parse_nfse_joinville_pdf(content)
        except NFeParserError as e:
            raise HTTPException(400, {"code": e.code, "message": e.message})
    else:
        parsed = _parse_or_400(content)

    # resto idêntico ao código atual:
    # - WRONG_DIRECTION check (parsed.emitente_cnpj != empresa)
    # - DUPLICATE check (chave_acesso)
    # - cliente_link, sugestoes, return
```

`POST /import-nfe` **não muda** (recebe `ImportNFeReceberRequest`, agnóstico).

## Migration

```python
# alembic/versions/<hash>_expand_nota_fiscal_columns.py

def upgrade():
    op.alter_column(
        "notas_fiscais", "chave_acesso",
        type_=sa.String(50),
        existing_type=sa.String(44),
        existing_nullable=False,
    )
    op.alter_column(
        "notas_fiscais", "modelo",
        type_=sa.String(10),
        existing_type=sa.String(2),
        existing_nullable=False,
    )

def downgrade():
    op.alter_column(
        "notas_fiscais", "modelo",
        type_=sa.String(2),
        existing_type=sa.String(10),
        existing_nullable=False,
    )
    op.alter_column(
        "notas_fiscais", "chave_acesso",
        type_=sa.String(44),
        existing_type=sa.String(50),
        existing_nullable=False,
    )
```

**Segurança em produção:** no PostgreSQL, aumentar o tamanho de uma coluna `VARCHAR(N) → VARCHAR(M>N)` é operação de metadata, **não reescreve a tabela nem afeta os dados existentes**. Notas já cadastradas com chave de 44 caracteres e modelo "55" permanecem intactas.

O model SQLAlchemy `NotaFiscal` (`app/models/nota_fiscal.py`) é atualizado em paralelo para `String(50)` e `String(10)` respectivamente.

## Frontend

### `ImportarNFEReceberModal.tsx`

- `<input type="file" accept=".xml,.pdf">` (era `.xml`)
- Mensagem de validação client-side: avisar antes de enviar PDF > 5 MB
- Texto de instrução: "Selecione o arquivo XML da NF-e ou PDF da NFS-e"
- Chip pequeno no preview: se `preview.parsed.modelo === "NFSE"` → mostrar badge "NFS-e"; se `"55"` → "NF-e" (opcional mas implementado)

### `ContasReceberPage.tsx`

- Botão "Importar XML" → "Importar Nota"

Tipos TypeScript (`frontend/src/types/nfe.ts`) **não mudam** — o backend continua retornando o mesmo schema.

## Testes

### Backend

**`tests/test_nfse_joinville_parser.py` (novo)** — parser puro:

- `test_parse_pdf_real_162` — usa fixture do PDF do dono; valida todos os campos extraídos
- `test_vencimento_unico_texto_livre` — "vencimento dia 02/06/26"
- `test_multiplos_vencimentos` — "vencimentos: 02/06, 02/07, 02/08" (fixture sintético)
- `test_sem_vencimento` — discriminação sem nenhuma data → `parcelas = []`
- `test_pdf_invalido` — bytes que não são PDF → `INVALID_PDF`
- `test_nao_e_nfse_joinville` — PDF qualquer outro → `NOT_NFSE_JOINVILLE`
- `test_missing_cnpj_prestador` — fixture mutilado → `MISSING_FIELDS`

**`tests/test_import_nfe_receber.py` (extender)** — fluxo via PDF:

- `test_preview_pdf_ok` — POST `/preview-nfe` com PDF retorna preview correto + cliente_link se Víqua já existe
- `test_preview_pdf_wrong_direction` — fixture onde prestador ≠ EMPRESA_CNPJ → 400 `WRONG_DIRECTION`
- `test_import_pdf_cria_conta_receber` — preview + import resulta em ContaReceber persistida
- `test_import_pdf_duplicate` — re-importar mesmo PDF → 400 `DUPLICATE`
- `test_preview_pdf_too_large` — arquivo > 5 MB → 413

### Frontend

Smoke test manual no modal (selecionar PDF, ver preview pré-preenchido, confirmar import).

## Critérios de aceitação

1. Dono faz upload do PDF "Nota 162 viqua" no modal de Contas a Receber
2. Sistema extrai: prestador (LSC, CNPJ 53.428.953/0001-11), tomador (Víqua, CNPJ 00.477.761/0001-39), valor R$ 10.776,00, número 162, data emissão 12/05/2026, vencimento 02/06/2026 (1 parcela)
3. Modal abre em modo "review" com tudo pré-preenchido, chip "NFS-e" visível
4. Confirmação cria `ContaReceber` vinculada ao cliente Víqua (cria cliente se não existir) e registra `NotaFiscal` com chave nacional de 50 dígitos
5. Re-importar o mesmo PDF retorna `DUPLICATE` com link pra conta existente
6. Importar PDF onde o prestador não é a LSC retorna `WRONG_DIRECTION`
7. Notas já existentes (NF-e XML, chave 44) seguem funcionando sem regressão
