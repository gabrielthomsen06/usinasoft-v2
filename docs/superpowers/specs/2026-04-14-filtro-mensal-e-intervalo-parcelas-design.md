# Filtro mensal e correção do intervalo em parcelas

Data: 2026-04-14
Telas afetadas: Contas a Receber, Contas a Pagar, Lançamentos

## Contexto

Hoje o módulo financeiro exibe todas as contas em uma única lista. Para uma operação com dezenas de parcelas e lançamentos por mês, isso dificulta a visão de "o que há pra receber/pagar neste mês". Além disso, a regra atual de parcelamento trata o campo `intervalo_dias` apenas como espaçamento entre parcelas — o 1º vencimento é digitado manualmente pelo usuário. O cliente quer que o intervalo também determine o 1º vencimento (hoje + intervalo). Por fim, o modal de edição de conta não expõe o campo de intervalo nem permite propagar mudanças para as parcelas seguintes.

## Objetivos

1. Permitir visualizar contas a receber, contas a pagar e lançamentos segmentados por mês, com navegação entre meses e foco no mês corrente.
2. Corrigir a regra de parcelamento: o intervalo deve pré-preencher o 1º vencimento como `hoje + intervalo`.
3. Liberar a edição do intervalo em contas já criadas e permitir cascata (recalcular parcelas futuras) quando a parcela editada é a 1ª de um grupo.

## Não-objetivos

- Agrupamento visual com várias seções simultâneas (abas/scroll) — fica com um único mês por vez.
- Edição cascata a partir de qualquer parcela intermediária — apenas a parcela 1 propaga.
- Mudança do backend de Lançamentos quanto ao filtro de datas — ele já aceita `data_inicio` e `data_fim`.

## Arquitetura

### Bloco 1 — Navegação mensal

**Frontend**

- Novo componente `frontend/src/components/ui/MonthNavigator.tsx`:
  - Props: `mes: number` (1-12), `ano: number`, `onChange(mes, ano)`.
  - UI: `◀  Abril / 2026  ▶` com botão "Hoje" que reseta para o mês corrente.
  - Estado controlado pelo componente pai.
- `ContasReceber.tsx`, `ContasPagar.tsx` e `Lancamentos.tsx`:
  - Inicializam `mes`/`ano` com o mês corrente.
  - Calculam `dataInicio` e `dataFim` do mês (primeiro e último dia) em ISO `YYYY-MM-DD`.
  - Enviam esses valores ao backend via querystring.
  - Totalizadores (Total / Pendente / Pago / Vencido) refletem apenas o mês selecionado.
- Em `Lancamentos.tsx`: os campos livres `dataInicio`/`dataFim` são substituídos pelo `MonthNavigator`. O agrupamento por data continua.

**Backend**

- `backend/app/api/routes/contas_receber.py` e `contas_pagar.py`:
  - Endpoint `GET /` passa a aceitar `data_vencimento_inicio: date | None` e `data_vencimento_fim: date | None`.
  - Quando presentes, adicionam filtro `WHERE data_vencimento BETWEEN :inicio AND :fim` à query.
  - Parâmetros opcionais — retrocompatível.
- `lancamentos.py`: já aceita `data_inicio`/`data_fim`. Sem mudança.

### Bloco 2 — Regra do intervalo no cadastro

Mudança somente no frontend, nos modais de criação de `ContasReceber.tsx` e `ContasPagar.tsx`.

- Novo estado local `vencimentoManualmenteAlterado: boolean` no form (reset no `openCreate`).
- Handler `onChange` do campo `intervalo_dias`:
  - Se `vencimentoManualmenteAlterado === false`, recalcula `form.data_vencimento = hoje + intervalo` (em ISO).
  - Se `intervalo_dias` ficar vazio, não altera `data_vencimento`.
- Handler `onChange` do campo `data_vencimento`:
  - Marca `vencimentoManualmenteAlterado = true`.
- Preview da caixa azul continua inalterado — ela já lê `data_vencimento` e `intervalo_dias` do form.
- Backend: nenhuma mudança. A geração das parcelas seguintes já soma `intervalo_dias` a partir de `data_vencimento`.

### Bloco 3 — Edição com cascata e coluna de grupo

**Schema / Migração**

- Nova coluna `grupo_parcelas_id: UUID NULL` em `contas_receber` e `contas_pagar`.
- Indexada para lookup rápido (`CREATE INDEX` em cada tabela).
- Alembic migration:
  1. `ADD COLUMN grupo_parcelas_id UUID NULL` + index.
  2. Data migration: para registros existentes com `total_parcelas > 1`, agrupa por `(descricao, cliente_id/fornecedor_id, total_parcelas, data_emissao)` e atribui um UUID único por grupo. Registros com `total_parcelas = 1` ficam `NULL`.

**Services (backend)**

- `conta_receber_service.py` / `conta_pagar_service.py`:
  - Função `criar_com_parcelas`: gera um UUID e aplica a todas as parcelas criadas.
  - Nova função `atualizar_conta(id, payload, recalcular_parcelas_futuras: bool)`:
    - Atualiza o registro-alvo (incluindo `data_vencimento` e `intervalo_dias`).
    - Se `recalcular_parcelas_futuras = True` e `parcela_atual == 1` e `grupo_parcelas_id` não for `NULL`:
      - Busca parcelas 2..N do mesmo grupo com `status != 'pago'`.
      - Para cada uma: `nova_data = nova_data_1 + intervalo * (parcela_atual - 1)`.
      - Atualiza `data_vencimento` e `intervalo_dias` dessas parcelas.

**Schemas**

- `ContaReceberUpdate` / `ContaPagarUpdate`:
  - Adicionar `intervalo_dias: int | None`.
  - Campo adicional no request body: `recalcular_parcelas_futuras: bool = False`.

**Frontend — modal de edição**

- Exibir campo **Intervalo (dias)** no `openEdit` (hoje fica atrás do guard `!editingId`).
- Se `editingItem.parcela_atual === 1 && editingItem.total_parcelas > 1`:
  - Mostrar checkbox **"Recalcular parcelas futuras (2..N)"** (default marcado).
  - Texto auxiliar: "As parcelas 2 a N serão recalculadas com base no novo 1º vencimento e intervalo. Parcelas já pagas serão mantidas."
- Payload de update inclui `recalcular_parcelas_futuras` quando o checkbox estiver marcado.

## Fluxos principais

### Fluxo 1 — Usuário abre Contas a Receber

1. Página carrega, `mes`/`ano` = mês corrente.
2. `GET /contas-receber?data_vencimento_inicio=2026-04-01&data_vencimento_fim=2026-04-30`.
3. Tabela e cards mostram só o mês de abril.
4. Usuário clica `▶`: avança para maio, dispara novo fetch.

### Fluxo 2 — Usuário cadastra conta parcelada com intervalo

1. Abre modal "Nova Conta a Receber".
2. Digita descrição, cliente, valor 1500, `total_parcelas = 3`, `intervalo_dias = 28`.
3. Campo "1º Vencimento" é pré-preenchido com `hoje + 28 dias` = 2026-05-12.
4. Preview: "3x de R$ 500,00 — Vencimentos a cada 28 dias a partir de 12/05/2026".
5. Submete: backend cria parcelas com vencimentos 12/05, 09/06, 07/07, todas com mesmo `grupo_parcelas_id`.

### Fluxo 3 — Usuário edita 1ª parcela de grupo e propaga

1. Navega até o mês da 1ª parcela, clica em editar.
2. Modal abre com campo "Intervalo" visível e checkbox "Recalcular parcelas futuras" marcado.
3. Muda 1º vencimento para 15/05 e intervalo para 30.
4. Submete. Backend:
   - Atualiza parcela 1/3 → vencimento 15/05, intervalo 30.
   - Parcelas 2/3 e 3/3 (se não pagas) recebem 14/06 e 14/07.
5. Lista recarrega, totalizadores e meses afetados se ajustam.

## Modelo de dados

### contas_receber

| Campo               | Tipo     | Obs.                                        |
|---------------------|----------|---------------------------------------------|
| grupo_parcelas_id   | UUID NULL| **NOVO** — igual em todas as parcelas do grupo |

Idem para `contas_pagar`.

## Tratamento de erros

- Se `recalcular_parcelas_futuras = True` mas `parcela_atual != 1`: backend ignora a flag (segurança — frontend só envia quando aplicável).
- Se `grupo_parcelas_id` for `NULL` (conta sem parcelas múltiplas): flag ignorada.
- Parcelas com `status = 'pago'` são explicitamente puladas na cascata — evita retrabalho e preserva integridade do lançamento gerado pelo pagamento.

## Testes

- **Backend (pytest):**
  - Filtro mensal retorna só contas do período.
  - Cascata recalcula parcelas 2..N corretamente.
  - Cascata pula parcelas pagas.
  - Cascata não age em parcela intermediária mesmo com flag `true`.
  - Migração popula `grupo_parcelas_id` agrupando corretamente.
- **Frontend (manual):**
  - Navegação de mês atualiza dados e totais.
  - Digitar intervalo pré-preenche vencimento; digitar vencimento bloqueia o auto-cálculo.
  - Edição da parcela 1 exibe checkbox; edição da 2 não exibe.

## Escopo fora

- Exportação / relatórios por mês.
- Agrupamento visual multi-mês na mesma tela.
- Recomputar totais projetados (fluxo de caixa).
