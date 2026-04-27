# Importação de NF-e via XML — Pré-cadastro de Conta a Pagar

**Status:** Design aprovado, aguardando plano de execução
**Data:** 2026-04-27
**Escopo:** V1 — somente NF-e modelo 55 (produto), via XML, gerando Conta a Pagar

## Motivação

O cliente (oficina de usinagem) recebe muitas notas fiscais de fornecedores por e-mail. Hoje, ele cadastra cada Conta a Pagar manualmente, digitando descrição, fornecedor, valor, datas e parcelas. O objetivo é permitir que ele anexe o XML da NF-e e o sistema gere um pré-cadastro com os campos preenchidos, restando apenas revisar e salvar.

## Decisões de escopo (V1)

| Decisão | Escolha | Motivo |
|---|---|---|
| Formato aceito | Apenas XML da NF-e | Padronizado pela SEFAZ, parsing 100% confiável, zero dependência nova |
| Tipo de NF | Modelo 55 (produto) | Cobre o caso principal do cliente; NFS-e e NFC-e ficam para V2 |
| Direção | Apenas Conta a Pagar (NF que ele recebe) | Dor original; Conta a Receber fica para V2 |
| Fluxo | Modal de revisão na tela Contas a Pagar | Caminho mais curto entre "recebi NF" e "lançado" |
| Parcelas | Detecta `<cobr>/<dup>` e cria N contas | Aproveita dado fiscal exato; usuário ajusta no modal |
| Fornecedor novo | Auto-cadastra com badge no modal | Sem fricção, mas com visibilidade |
| Categoria | Default `material` | Caso esperado para NF-e modelo 55 |
| Armazenamento | Apenas metadados (chave, número, CNPJ, valor, data) | Cliente mantém XML no e-mail; deduplicação preservada |

## Fora de escopo (V2 explícito)

- Parsing de PDF / OCR
- NFS-e (serviço, formato varia por município)
- NFC-e modelo 65 (cupom fiscal)
- NF-e emitida pela própria empresa → Conta a Receber
- Inferir categoria por fornecedor (memória de última escolha)
- Multi-upload (vários XMLs de uma vez)
- Armazenar XML cru
- Re-importar / atualizar nota já importada
- Usar `pag/detPag/tPag` (forma de pagamento) para classificação
- Usar `infAdic/infCpl` (informação complementar) nas observações

## Fluxo do usuário

1. Cliente está na tela **Contas a Pagar**. Ao lado do botão "Nova Conta", aparece **"Importar XML"**.
2. Clica → seletor de arquivo `.xml`.
3. Backend valida e parseia o XML, busca fornecedor pelo CNPJ, retorna JSON com os campos extraídos. **Não persiste nada nesse passo.**
4. Frontend abre o **modal de revisão** com formulário pré-preenchido:
   - **Descrição** — sugestão `"NF-e nº <nNF> - <xFant ou xNome>"` (editável).
   - **Fornecedor** — auto-vinculado pelo CNPJ. Se não existia, badge azul **"Novo fornecedor: <nome>"**.
   - **Valor total** — `total/ICMSTot/vNF`.
   - **Data de emissão** — `ide/dhEmi` (ISO 8601 com timezone, converte para `date` local).
   - **Categoria** — default `material` (editável; lista atual: material, serviços, fixas, impostos, carro, gasolina, salário, aluguel, patrimônio, outros).
   - **Parcelas** — tabela com cada `<dup>`: número, vencimento (`dVenc`), valor (`vDup`). Campos editáveis. Se for à vista (1 dup), mostra um vencimento único.
   - **Observações** — pré-preenchido com chave de acesso formatada e lista resumida de itens. Editável.
5. Cliente revisa, ajusta, clica **Salvar**.
6. Backend, em uma transação:
   - Cria `Fornecedor` (se novo).
   - Cria N `ContaPagar` (uma por parcela), todas com mesmo `grupo_parcelas_id`.
   - Insere registro em `notas_fiscais` (metadados + link via `grupo_parcelas_id`).
7. Se o `chNFe` já existir em `notas_fiscais` no preview → backend retorna `409` com mensagem `"Esta NF-e já foi importada em DD/MM/AAAA"` e os IDs das contas existentes; frontend exibe aviso e não abre o modal.

## Modelo de dados

### Nova tabela `notas_fiscais`

```
id                   uuid PK
chave_acesso         varchar(44) UNIQUE NOT NULL  -- chNFe
numero_nota          varchar(20)         NOT NULL  -- nNF
serie                varchar(10)
modelo               varchar(2)          NOT NULL  -- "55"
cnpj_emitente        varchar(14)         NOT NULL
nome_emitente        varchar(255)        NOT NULL  -- razão social (xNome)
valor_total          numeric(12,2)       NOT NULL
data_emissao         date                NOT NULL
grupo_parcelas_id    uuid                          -- liga a ContaPagar(grupo_parcelas_id)
created_at           timestamptz         NOT NULL
created_by_user_id   uuid FK usuarios    NOT NULL
```

Índice em `chave_acesso` (unique) e em `cnpj_emitente`.

A relação com `ContaPagar` é via `grupo_parcelas_id` (já existente no model `ContaPagar`). Não há FK explícita do lado de `ContaPagar` apontando para `notas_fiscais` — a navegação é por agrupamento. Justificativa: minimiza alterações no model existente.

### Migração Alembic

- Cria a tabela `notas_fiscais` com os campos acima.
- Sem alterações em `contas_pagar` ou `fornecedores`.

## Backend

### Parser — `app/services/nfe_parser.py`

- Função `parse_nfe_xml(xml_bytes: bytes) -> NFeParsedData`.
- Usa `xml.etree.ElementTree` da stdlib (zero dependência nova).
- Namespace SEFAZ: `http://www.portalfiscal.inf.br/nfe`.

**Estratégia de parsing:**

1. Tenta parsear como `nfeProc` (envelope com protocolo). Se a raiz for `NFe` direto, trata como tal.
2. Localiza `infNFe` e valida `infNFe/ide/mod == "55"`. Se não for, levanta `NFeParserError("UNSUPPORTED_MODEL", "Apenas NF-e modelo 55 é suportada")`.
3. Se houver `protNFe`, valida `protNFe/infProt/cStat == "100"` (Autorizado). Se não for `100`, levanta `NFeParserError("NOT_AUTHORIZED", f"NF-e não autorizada (status {cStat})")`.
4. Extrai a chave de acesso preferindo `protNFe/infProt/chNFe`; se não houver protocolo, extrai do `infNFe/@Id` removendo o prefixo `NFe`.
5. Extrai os campos.

**Estrutura `NFeParsedData` (Pydantic):**

```python
class NFeParcelaParsed(BaseModel):
    numero: str         # nDup, ex: "001"
    vencimento: date    # dVenc
    valor: Decimal      # vDup

class NFeItemParsed(BaseModel):
    descricao: str      # xProd
    quantidade: Decimal # qCom
    valor_total: Decimal # vProd

class NFeParsedData(BaseModel):
    chave_acesso: str
    numero_nota: str
    serie: str
    modelo: str
    data_emissao: date
    valor_total: Decimal
    emitente_cnpj: str
    emitente_nome: str        # xNome (razão social)
    emitente_fantasia: str | None  # xFant
    emitente_email: str | None
    parcelas: list[NFeParcelaParsed]   # vazia se não houver <cobr>/<dup>
    itens: list[NFeItemParsed]
```

**Tratamento de erros do parser:**

- XML malformado → `NFeParserError("INVALID_XML", "Arquivo XML inválido")`.
- Não é NF-e (raiz desconhecida) → `NFeParserError("NOT_NFE", "Arquivo não é uma NF-e")`.
- Modelo ≠ 55 → `NFeParserError("UNSUPPORTED_MODEL", ...)`.
- Status ≠ 100 → `NFeParserError("NOT_AUTHORIZED", ...)`.
- Faltam campos obrigatórios (chNFe, vNF, dhEmi) → `NFeParserError("MISSING_FIELDS", ...)`.

### Endpoints

Localização sugerida: `app/api/routes/contas_pagar.py` (mantém perto do contexto). Aceita criar `nfe.py` separado se ficar muito grande.

#### `POST /contas-pagar/preview-nfe`

- Multipart upload de um único arquivo `.xml`.
- Limite: 1 MB (XML real fica em ~50 KB; limite gera erro claro pra arquivos suspeitos).
- Roda `parse_nfe_xml`.
- Verifica duplicidade: `SELECT FROM notas_fiscais WHERE chave_acesso = :chave`. Se existir, retorna `409` com `{ chave_acesso, importada_em, contas_pagar_ids: [...] }`.
- Busca `Fornecedor` por `cnpj_cpf == emitente_cnpj`.
- Retorna `200` com:

```json
{
  "parsed": NFeParsedData,
  "fornecedor": { "id": "...", "nome": "..." } | null,
  "sugestoes": {
    "descricao": "NF-e nº 15473 - PWM REGUAS DIGITAIS",
    "categoria": "material",
    "observacoes": "Chave: ...\nItens:\n- 1x MOLA DE RETORNO ... (R$ 150,00)"
  }
}
```

- Não persiste nada.
- Erros do parser → `400` com `{ code, message }`.

#### `POST /contas-pagar/import-nfe`

- Body JSON com os dados revisados pelo usuário:

```json
{
  "chave_acesso": "...",
  "fornecedor": {
    "id": "..." | null,
    "nome": "...",
    "cnpj": "...",
    "email": "..." | null
  },
  "descricao": "...",
  "categoria": "material",
  "observacoes": "...",
  "data_emissao": "2026-04-27",
  "parcelas": [
    { "vencimento": "2026-05-18", "valor": "150.00" }
  ]
}
```

- Em uma transação SQLAlchemy:
  1. Re-verifica duplicidade da chave (proteção contra race) → `409` se já existe.
  2. Se `fornecedor.id` veio nulo, cria `Fornecedor` (nome, cnpj_cpf, email).
  3. Gera `grupo_parcelas_id = uuid4()`.
  4. Cria N `ContaPagar`, uma por parcela, com:
     - `descricao` = `descricao` recebida (todas iguais; o usuário pode personalizar antes)
     - `fornecedor_id`
     - `valor` = `parcela.valor`
     - `data_emissao`
     - `data_vencimento` = `parcela.vencimento`
     - `categoria`
     - `parcela_atual` = i+1
     - `total_parcelas` = N
     - `grupo_parcelas_id`
     - `intervalo_dias` = se N > 1, calcula a partir das duas primeiras parcelas; senão `None`
     - `observacoes`
  5. Insere em `notas_fiscais` com `grupo_parcelas_id` e `created_by_user_id`.
- Retorna `201` com `{ contas_pagar_ids: [...], fornecedor_id, nota_fiscal_id }`.

### Códigos HTTP e mensagens

| Cenário | Status | Body |
|---|---|---|
| Sucesso preview | 200 | `{ parsed, fornecedor, sugestoes }` |
| Sucesso import | 201 | `{ contas_pagar_ids, fornecedor_id, nota_fiscal_id }` |
| XML inválido / formato errado | 400 | `{ code, message }` |
| NF-e duplicada | 409 | `{ code: "DUPLICATE", chave_acesso, importada_em, contas_pagar_ids }` |
| Arquivo > 1 MB | 413 | `{ code: "FILE_TOO_LARGE" }` |
| Não autenticado | 401 | padrão |

## Frontend

### Novo componente — `frontend/src/components/contas-pagar/ImportarNFEModal.tsx`

Estados:

- `idle` — input de arquivo `.xml`. Mensagem: "Selecione o XML da NF-e recebida do fornecedor."
- `uploading` — spinner.
- `reviewing` — formulário pré-preenchido.
- `saving` — botão "Salvar" desabilitado, spinner.
- `error` — exibe `code` e `message` retornados pelo backend. Caso especial `DUPLICATE` mostra link para a(s) conta(s) existentes.

**Em `reviewing`:**

- Reusa os mesmos componentes de input do form atual de Contas a Pagar (consistência visual).
- Banner azul no topo se `fornecedor` veio `null`: **"Novo fornecedor será cadastrado: <nome>"**.
- Tabela de parcelas com `vencimento` (date input) e `valor` (number input) editáveis. Sem permitir adicionar/remover parcelas no V1 (mantém o que veio do XML).
- Botão "Salvar" → chama `import-nfe` e fecha o modal em sucesso, recarregando a lista.
- Botão "Cancelar" → fecha sem persistir.

### Página `ContasPagar.tsx`

- Adiciona botão **"Importar XML"** ao lado do botão "Nova Conta".
- Abre `ImportarNFEModal`.
- No callback de sucesso, dá refresh na lista.

### Novos services — `frontend/src/services/nfe.ts`

```typescript
export async function previewNfe(file: File): Promise<PreviewNfeResponse>
export async function importNfe(payload: ImportNfePayload): Promise<ImportNfeResponse>
```

### Novos types — `frontend/src/types/nfe.ts`

Mirror dos schemas Pydantic do backend.

## Edge cases e tratamento

| Caso | Comportamento |
|---|---|
| XML é NFC-e (modelo 65) | Erro `UNSUPPORTED_MODEL`, mensagem clara |
| XML é NFS-e | Erro `NOT_NFE` (estrutura raiz diferente) |
| NF-e cancelada (cStat ≠ 100) | Erro `NOT_AUTHORIZED` |
| NF-e sem `<cobr>/<dup>` (à vista, sem duplicata) | 1 parcela com vencimento = `dhEmi` (default razoável; usuário ajusta) |
| Fornecedor existe mas com nome diferente | Mantém o nome cadastrado, vincula pelo CNPJ. Não atualiza nome silenciosamente |
| Parcelas com soma ≠ valor total | Aceita (o XML pode ter desconto/frete que justifica). Nenhuma validação cruzada no V1 |
| Race condition (dois uploads simultâneos da mesma chave) | UNIQUE em `chave_acesso` garante; segundo `INSERT` falha → backend converte em `409` |
| XML maior que 1 MB | `413` com mensagem clara |
| Usuário cancela no meio do fluxo | Nada persiste (preview não escreve no banco) |

## Testes

**Backend:**

- `test_nfe_parser.py` — fixtures de XMLs reais (NF-e modelo 55 com 1 parcela, com N parcelas, sem `<cobr>`, cancelada, NFC-e, malformada). Testa cada caso do parser.
- `test_import_nfe.py` — testes de integração dos endpoints: preview, import, duplicidade, fornecedor novo vs existente, criação de N contas com `grupo_parcelas_id`.

**Frontend:**

- Não há infraestrutura de testes E2E hoje no projeto. V1 valida manualmente com o XML de exemplo do cliente.

## Considerações de segurança

- Validar Content-Type no upload (`text/xml` ou `application/xml`).
- Limite de tamanho de 1 MB no endpoint.
- Usar parser XML seguro: `xml.etree.ElementTree` com `defusedxml` para evitar ataques XXE / billion laughs. Adicionar `defusedxml` ao `requirements.txt` (única dependência nova).
- Endpoints exigem autenticação (mesma policy dos demais endpoints).
- `created_by_user_id` em `notas_fiscais` para auditoria.

## Dependências novas

- `defusedxml` — parser XML seguro contra XXE. Lightweight, mantido pela PSF.

## Arquivos afetados

**Novos:**

- `backend/app/models/nota_fiscal.py`
- `backend/app/services/nfe_parser.py`
- `backend/app/schemas/nfe.py`
- `backend/alembic/versions/<hash>_create_notas_fiscais.py`
- `backend/tests/test_nfe_parser.py`
- `backend/tests/test_import_nfe.py`
- `backend/tests/fixtures/nfe/*.xml`
- `frontend/src/components/contas-pagar/ImportarNFEModal.tsx`
- `frontend/src/services/nfe.ts`
- `frontend/src/types/nfe.ts`

**Alterados:**

- `backend/app/models/__init__.py` (registrar `NotaFiscal`)
- `backend/app/api/routes/contas_pagar.py` (novos endpoints `preview-nfe` e `import-nfe`)
- `backend/requirements.txt` (adicionar `defusedxml`)
- `frontend/src/pages/ContasPagar.tsx` (botão "Importar XML" e integração do modal)
