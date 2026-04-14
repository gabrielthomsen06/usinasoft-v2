# Design — Intervalo de dias no parcelamento e desfazer pagamento

Data: 2026-04-14
Escopo: `contas_pagar` e `contas_receber` (backend + frontend)

---

## Contexto

Duas lacunas foram identificadas pelo cliente em uso real:

1. **Parcelamento rígido:** hoje contas a pagar parcelam sempre em intervalo mensal (`relativedelta(months=i)`). O cliente precisa poder definir um intervalo arbitrário em dias (ex.: R$ 2.000 em 2x com 14 dias de intervalo). Contas a receber ainda não tem parcelamento algum.
2. **Pagamento irreversível:** quando uma conta é marcada como paga, o sistema cria automaticamente um `Lancamento`. Não existe caminho para desfazer essa ação sem apagar manualmente no banco.

Este documento especifica as duas mudanças.

---

## Feature 1 — Intervalo de dias no parcelamento

### Regra de negócio

- Em **contas a pagar** e **contas a receber**, ao criar um registro, o usuário pode informar:
  - `total_parcelas` (int ≥ 1, padrão 1)
  - `intervalo_dias` (int opcional, sem valor padrão)
- Comportamento:
  - Se `total_parcelas == 1`: cria 1 registro, ignora `intervalo_dias`.
  - Se `total_parcelas > 1` e `intervalo_dias` **está preenchido**: gera N registros com vencimento `data_vencimento + timedelta(days=intervalo_dias * i)` para `i` de 0 a N-1.
  - Se `total_parcelas > 1` e `intervalo_dias` **está vazio**: mantém o comportamento atual (`relativedelta(months=i)`).
- Valor de cada parcela: divisão igualitária com ajuste dos centavos na última parcela (regra já existente).
- Descrição: sufixo `(k/N)` quando `total_parcelas > 1` (regra já existente em contas a pagar).

### Backend

**Modelo `ContaReceber` (`backend/app/models/conta_receber.py`)**
- Adicionar colunas:
  - `parcela_atual: Mapped[int]` — Integer, `default=1`, `server_default="1"`, `nullable=False`
  - `total_parcelas: Mapped[int]` — Integer, `default=1`, `server_default="1"`, `nullable=False`
- Criar migration Alembic correspondente.

**Schemas (`backend/app/schemas/conta_pagar.py`)**
- `ContaPagarCreate`: adicionar `intervalo_dias: Optional[int] = None`.
- `ContaPagarResponse`: nenhuma mudança (campos `parcela_atual`/`total_parcelas` já existem).

**Schemas (`backend/app/schemas/conta_receber.py`)**
- `ContaReceberCreate`: adicionar `total_parcelas: int = 1` e `intervalo_dias: Optional[int] = None`.
- `ContaReceberResponse`: adicionar `parcela_atual: int = 1` e `total_parcelas: int = 1`.

**Service `conta_pagar_service.create_conta_pagar`**
- Ler `intervalo_dias` do payload.
- Trocar o cálculo do vencimento por:
  ```python
  if intervalo_dias:
      vencimento = data.data_vencimento + timedelta(days=intervalo_dias * i)
  else:
      vencimento = data.data_vencimento + relativedelta(months=i)
  ```

**Service `conta_receber_service.create_conta_receber`**
- Replicar a estrutura de `create_conta_pagar`:
  - Retornar `List[ContaReceber]`.
  - Divisão do valor com ajuste na última parcela.
  - Sufixo `(k/N)` na descrição quando `total_parcelas > 1`.
  - Mesma lógica de intervalo (dias ou meses).
- Remover o retorno simples atual.

**Route `contas_receber.py`**
- Mudar `response_model` do POST de `ContaReceberResponse` para `List[ContaReceberResponse]`.
- Mudar `status_code` para `201` (já está).

### Frontend

**`frontend/src/types/index.ts`**
- Adicionar `intervalo_dias?: number` em `ContaPagarCreate`.
- Adicionar `total_parcelas?: number` e `intervalo_dias?: number` em `ContaReceberCreate`.
- Adicionar `parcela_atual: number` e `total_parcelas: number` em `ContaReceber`.

**`frontend/src/services/contasReceber.ts`**
- Ajustar `create` para retornar `ContaReceber[]` (backend passa a retornar array).

**`frontend/src/pages/ContasPagar.tsx`**
- Adicionar input numérico "Intervalo (dias)" ao lado de "Parcelas" (visível apenas em criação, não em edição).
- Atualizar o preview quando `intervalo_dias` preenchido: "Nx de R$ V — vencimentos a cada X dias a partir de DD/MM/AAAA".
- Quando vazio, mantém o texto "Vencimentos mensais a partir de ...".

**`frontend/src/pages/ContasReceber.tsx`**
- Adicionar inputs "Parcelas" e "Intervalo (dias)" análogos a ContasPagar.
- Incluir preview idêntico ao de ContasPagar.
- Exibir sufixo `Parcela k/N` no card da conta (igual ContasPagar faz hoje).
- Ajustar a chamada de `create` para lidar com array.

---

## Feature 2 — Desfazer pagamento

### Regra de negócio

- Válido para **contas a pagar** e **contas a receber**.
- Quando `status` transita de `"pago"` para qualquer outro status (esperado: `"pendente"`):
  - Deletar o `Lancamento` vinculado (via `conta_pagar_id` ou `conta_receber_id`).
  - Limpar `data_pagamento` (set para `None`).
- Nenhum endpoint novo: a transição é detectada pelo `PUT` já existente.

### Backend

**Service `conta_pagar_service.update_conta_pagar`**
- Após aplicar o `update_data`, detectar a transição:
  ```python
  was_paid = conta.status == "pago"  # capturar ANTES do setattr
  # ... setattr loop ...
  if was_paid and conta.status != "pago":
      result = await db.execute(
          select(Lancamento).where(Lancamento.conta_pagar_id == conta.id)
      )
      for lanc in result.scalars().all():
          await db.delete(lanc)
      conta.data_pagamento = None
  ```
- Cuidado: `was_pending`/`was_paid` devem ser capturados **antes** do `setattr` (o código atual já faz isso; basta adicionar o oposto).

**Service `conta_receber_service.update_conta_receber`**
- Mesma lógica.

### Frontend

**`ContasPagar.tsx` e `ContasReceber.tsx`**
- Novo botão "Desfazer" (ícone `RotateCcw` ou similar) na linha da conta, visível **apenas** quando `status === 'pago'`.
- Posicionar ao lado dos botões Editar/Excluir.
- Ao clicar: modal de confirmação "Tem certeza que deseja desfazer o pagamento desta conta? O lançamento correspondente será removido."
- Ao confirmar: chamar `update(id, { status: 'pendente', data_pagamento: null })`, em seguida recarregar a listagem e mostrar toast.

---

## Arquivos impactados

| Arquivo | Tipo de mudança |
|---|---|
| `backend/app/models/conta_receber.py` | +2 colunas (`parcela_atual`, `total_parcelas`) |
| `backend/alembic/versions/<nova>.py` | migration criando as 2 colunas |
| `backend/app/schemas/conta_pagar.py` | +`intervalo_dias` em Create |
| `backend/app/schemas/conta_receber.py` | +`total_parcelas`, +`intervalo_dias` em Create; +campos em Response |
| `backend/app/services/conta_pagar_service.py` | parcelamento por dias + undo no update |
| `backend/app/services/conta_receber_service.py` | parcelamento completo + undo no update |
| `backend/app/api/routes/contas_receber.py` | POST retorna `List[ContaReceberResponse]` |
| `frontend/src/types/index.ts` | novos campos |
| `frontend/src/services/contasReceber.ts` | create retorna array |
| `frontend/src/pages/ContasPagar.tsx` | input intervalo + botão desfazer + modal |
| `frontend/src/pages/ContasReceber.tsx` | inputs parcelas/intervalo + preview + card parcela + botão desfazer + modal |

---

## Casos de borda

- **Intervalo = 0 dias:** todas as parcelas vencem no mesmo dia. Permitido — o usuário decide.
- **Intervalo negativo:** rejeitar via validação Pydantic (`ge=0` no schema).
- **Conta a receber sem parcelamento (N=1):** mantém o comportamento de registro único, mas o backend passa a retornar um array de 1 elemento. Frontend precisa lidar com isso.
- **Desfazer conta cujo lançamento já foi apagado manualmente:** o loop `for lanc in ... .all()` lida naturalmente (itera zero vezes). Ainda assim, a data_pagamento é limpa e o status volta a pendente — comportamento correto.
- **Desfazer e repagar:** ao desfazer, o lançamento é deletado; ao pagar de novo, o update_service cria um novo lançamento (lógica já existente). OK.

---

## Testes manuais (smoke)

1. Criar conta a pagar com 3 parcelas e intervalo de 15 dias → 3 registros com vencimentos espaçados de 15 dias.
2. Criar conta a pagar com 3 parcelas sem intervalo → 3 registros com vencimentos mensais (regressão).
3. Criar conta a receber com 2 parcelas e intervalo de 14 dias → 2 registros com descrições "(1/2)" e "(2/2)".
4. Marcar uma conta a receber como paga → aparece em Lançamentos.
5. Clicar "Desfazer" na conta paga → confirmação → conta volta para pendente, lançamento some.
6. Pagar de novo a conta desfeita → novo lançamento é criado normalmente.
