# Filtro mensal e correção do intervalo em parcelas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar navegação mensal nas telas financeiras, corrigir o cálculo do 1º vencimento para `hoje + intervalo`, e permitir editar intervalo/propagar para parcelas futuras.

**Architecture:** Três blocos independentes entrelaçando backend (FastAPI/SQLAlchemy/Alembic) e frontend (React/TS). Backend já aceita `data_inicio`/`data_fim` — o filtro mensal só precisa de UI. Adicionamos uma coluna `grupo_parcelas_id` (UUID) nas duas tabelas de contas para identificar parcelas-irmãs e habilitar cascata.

**Tech Stack:** Python 3 · FastAPI · SQLAlchemy 2 (async) · Alembic · Pydantic 2 · React 18 · TypeScript · TailwindCSS · Vite.

**Nota sobre testes:** este projeto ainda não tem suite automatizada (backend sem `tests/`, frontend idem). O plano usa verificação manual via `curl`/UI após cada bloco. Cada task termina em commit.

---

## File Structure

**Backend:**
- Create: `backend/alembic/versions/<nova_revision>_add_grupo_parcelas_id.py` — migração (coluna + backfill).
- Modify: `backend/app/models/conta_receber.py` — campo `grupo_parcelas_id`.
- Modify: `backend/app/models/conta_pagar.py` — campo `grupo_parcelas_id`.
- Modify: `backend/app/schemas/conta_receber.py` — `ContaReceberUpdate` ganha `intervalo_dias` e `recalcular_parcelas_futuras`; response inclui `grupo_parcelas_id`, `intervalo_dias`.
- Modify: `backend/app/schemas/conta_pagar.py` — idem.
- Modify: `backend/app/services/conta_receber_service.py` — `create` popula grupo, `update` trata cascata.
- Modify: `backend/app/services/conta_pagar_service.py` — idem.

**Frontend:**
- Create: `frontend/src/components/ui/MonthNavigator.tsx` — navegação `◀ Abril/2026 ▶ Hoje`.
- Create: `frontend/src/lib/monthRange.ts` — helper puro `getMonthRange(mes, ano) → { inicio, fim }`.
- Modify: `frontend/src/types/index.ts` — `ContaReceber` e `ContaPagar` ganham `grupo_parcelas_id?` e `intervalo_dias?`.
- Modify: `frontend/src/services/contasReceber.ts` — payload de update aceita `intervalo_dias` e `recalcular_parcelas_futuras`.
- Modify: `frontend/src/services/contasPagar.ts` — idem.
- Modify: `frontend/src/pages/ContasReceber.tsx` — plugar `MonthNavigator`, auto-cálculo do vencimento no cadastro, edição com intervalo e cascata.
- Modify: `frontend/src/pages/ContasPagar.tsx` — idem.
- Modify: `frontend/src/pages/Lancamentos.tsx` — substituir range manual por `MonthNavigator`.

---

## Task 1: Migration — adicionar `grupo_parcelas_id`

**Files:**
- Create: `backend/alembic/versions/f1a2b3c4d5e6_add_grupo_parcelas_id.py`

- [ ] **Step 1: Criar arquivo de migração**

```python
"""add_grupo_parcelas_id

Revision ID: f1a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2026-04-14 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for tabela in ('contas_receber', 'contas_pagar'):
        op.add_column(
            tabela,
            sa.Column('grupo_parcelas_id', UUID(as_uuid=True), nullable=True),
        )
        op.create_index(
            f'ix_{tabela}_grupo_parcelas_id',
            tabela,
            ['grupo_parcelas_id'],
        )

    # Backfill: agrupa parcelas existentes por chave natural
    op.execute("""
        WITH grupos AS (
            SELECT
                descricao,
                cliente_id,
                total_parcelas,
                data_emissao,
                gen_random_uuid() AS grupo_id
            FROM (
                SELECT DISTINCT
                    regexp_replace(descricao, ' \\([0-9]+/[0-9]+\\)$', '') AS descricao,
                    cliente_id,
                    total_parcelas,
                    data_emissao
                FROM contas_receber
                WHERE total_parcelas > 1
            ) d
        )
        UPDATE contas_receber c
        SET grupo_parcelas_id = g.grupo_id
        FROM grupos g
        WHERE regexp_replace(c.descricao, ' \\([0-9]+/[0-9]+\\)$', '') = g.descricao
          AND c.cliente_id = g.cliente_id
          AND c.total_parcelas = g.total_parcelas
          AND c.data_emissao = g.data_emissao
          AND c.total_parcelas > 1;
    """)

    op.execute("""
        WITH grupos AS (
            SELECT
                descricao,
                COALESCE(fornecedor_id::text, '00000000-0000-0000-0000-000000000000') AS fornecedor_key,
                total_parcelas,
                data_emissao,
                gen_random_uuid() AS grupo_id
            FROM (
                SELECT DISTINCT
                    regexp_replace(descricao, ' \\([0-9]+/[0-9]+\\)$', '') AS descricao,
                    fornecedor_id,
                    total_parcelas,
                    data_emissao
                FROM contas_pagar
                WHERE total_parcelas > 1
            ) d
        )
        UPDATE contas_pagar c
        SET grupo_parcelas_id = g.grupo_id
        FROM grupos g
        WHERE regexp_replace(c.descricao, ' \\([0-9]+/[0-9]+\\)$', '') = g.descricao
          AND COALESCE(c.fornecedor_id::text, '00000000-0000-0000-0000-000000000000') = g.fornecedor_key
          AND c.total_parcelas = g.total_parcelas
          AND c.data_emissao = g.data_emissao
          AND c.total_parcelas > 1;
    """)


def downgrade() -> None:
    for tabela in ('contas_receber', 'contas_pagar'):
        op.drop_index(f'ix_{tabela}_grupo_parcelas_id', table_name=tabela)
        op.drop_column(tabela, 'grupo_parcelas_id')
```

- [ ] **Step 2: Rodar a migração local**

```bash
cd backend && docker compose -f ../docker-compose.yml exec backend alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade a1b2c3d4e5f6 -> f1a2b3c4d5e6, add_grupo_parcelas_id` sem erros.

- [ ] **Step 3: Verificar backfill**

```bash
docker compose exec db psql -U postgres -d usinasoft -c "SELECT descricao, parcela_atual, grupo_parcelas_id FROM contas_receber WHERE total_parcelas > 1 ORDER BY grupo_parcelas_id, parcela_atual LIMIT 10;"
```

Expected: parcelas da mesma conta compartilham `grupo_parcelas_id`; parcelas unitárias ficam `NULL`.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/f1a2b3c4d5e6_add_grupo_parcelas_id.py
git commit -m "feat(db): adiciona grupo_parcelas_id em contas_receber e contas_pagar"
```

---

## Task 2: Models — expor `grupo_parcelas_id`

**Files:**
- Modify: `backend/app/models/conta_receber.py:36`
- Modify: `backend/app/models/conta_pagar.py:33`

- [ ] **Step 1: Adicionar campo em `ContaReceber`**

Após a linha `total_parcelas: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)`, inserir:

```python
    grupo_parcelas_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    intervalo_dias: Mapped[Optional[int]] = mapped_column(nullable=True)
```

**Nota:** `intervalo_dias` ainda não existe no modelo mas já é enviado no `create`; passará a ser persistido para habilitar a cascata consistente. Precisa incluir essa coluna também na migração.

- [ ] **Step 2: Atualizar Task 1 (migração) para incluir `intervalo_dias`**

Adicionar no `upgrade()` da migração, antes dos blocos de backfill:

```python
    for tabela in ('contas_receber', 'contas_pagar'):
        op.add_column(
            tabela,
            sa.Column('intervalo_dias', sa.Integer(), nullable=True),
        )
```

E no `downgrade()`:

```python
        op.drop_column(tabela, 'intervalo_dias')
```

Rerodar `alembic downgrade -1 && alembic upgrade head` para aplicar.

- [ ] **Step 3: Adicionar mesmo par de campos em `ContaPagar`** (após `total_parcelas`):

```python
    grupo_parcelas_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    intervalo_dias: Mapped[Optional[int]] = mapped_column(nullable=True)
```

- [ ] **Step 4: Verificar boot do backend sem erros**

```bash
docker compose logs backend --tail=30
```

Expected: aplicação inicia sem tracebacks de schema.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/conta_receber.py backend/app/models/conta_pagar.py backend/alembic/versions/f1a2b3c4d5e6_add_grupo_parcelas_id.py
git commit -m "feat(models): adiciona grupo_parcelas_id e intervalo_dias"
```

---

## Task 3: Schemas — update aceita intervalo e flag de cascata

**Files:**
- Modify: `backend/app/schemas/conta_receber.py:27-36`
- Modify: `backend/app/schemas/conta_pagar.py:31-40`

- [ ] **Step 1: Atualizar `ContaReceberUpdate`**

Substituir a classe `ContaReceberUpdate` por:

```python
class ContaReceberUpdate(BaseModel):
    descricao: Optional[str] = None
    cliente_id: Optional[uuid.UUID] = None
    ordem_producao_id: Optional[uuid.UUID] = None
    valor: Optional[float] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[date] = None
    status: Optional[ContaReceberStatus] = None
    observacoes: Optional[str] = None
    intervalo_dias: Optional[int] = Field(None, ge=0)
    recalcular_parcelas_futuras: bool = False
```

- [ ] **Step 2: Expor `grupo_parcelas_id` e `intervalo_dias` na response**

Adicionar em `ContaReceberResponse`, antes de `created_at`:

```python
    grupo_parcelas_id: Optional[uuid.UUID] = None
    intervalo_dias: Optional[int] = None
```

- [ ] **Step 3: Replicar o mesmo em `ContaPagarUpdate` e `ContaPagarResponse`**

`backend/app/schemas/conta_pagar.py` — substituir `ContaPagarUpdate`:

```python
class ContaPagarUpdate(BaseModel):
    descricao: Optional[str] = None
    fornecedor_id: Optional[uuid.UUID] = None
    valor: Optional[float] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[date] = None
    categoria: Optional[ContaPagarCategoria] = None
    status: Optional[ContaPagarStatus] = None
    observacoes: Optional[str] = None
    intervalo_dias: Optional[int] = Field(None, ge=0)
    recalcular_parcelas_futuras: bool = False
```

E em `ContaPagarResponse`, antes de `created_at`:

```python
    grupo_parcelas_id: Optional[uuid.UUID] = None
    intervalo_dias: Optional[int] = None
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/conta_receber.py backend/app/schemas/conta_pagar.py
git commit -m "feat(schemas): atualiza contas com intervalo_dias e flag de cascata"
```

---

## Task 4: Service — create popula `grupo_parcelas_id` e `intervalo_dias`

**Files:**
- Modify: `backend/app/services/conta_receber_service.py:63-94`
- Modify: `backend/app/services/conta_pagar_service.py:67-99`

- [ ] **Step 1: Atualizar `create_conta_receber`**

Substituir a função inteira:

```python
async def create_conta_receber(db: AsyncSession, data: ContaReceberCreate) -> List[ContaReceber]:
    total_parcelas = max(data.total_parcelas, 1)
    intervalo_dias = data.intervalo_dias
    base_data = data.model_dump(exclude={"total_parcelas", "intervalo_dias"})
    valor_total = base_data["valor"]
    valor_parcela = round(valor_total / total_parcelas, 2)
    valor_ultima = round(valor_total - valor_parcela * (total_parcelas - 1), 2)

    grupo_id = uuid.uuid4() if total_parcelas > 1 else None

    contas: List[ContaReceber] = []
    for i in range(total_parcelas):
        if intervalo_dias is not None:
            vencimento = data.data_vencimento + timedelta(days=intervalo_dias * i)
        else:
            vencimento = data.data_vencimento + relativedelta(months=i)
        conta = ContaReceber(
            **{
                **base_data,
                "valor": valor_parcela if i < total_parcelas - 1 else valor_ultima,
                "data_vencimento": vencimento,
                "parcela_atual": i + 1,
                "total_parcelas": total_parcelas,
                "grupo_parcelas_id": grupo_id,
                "intervalo_dias": intervalo_dias,
            }
        )
        if total_parcelas > 1:
            conta.descricao = f"{base_data['descricao']} ({i + 1}/{total_parcelas})"
        db.add(conta)
        contas.append(conta)

    await db.flush()
    for c in contas:
        await db.refresh(c)
    return contas
```

- [ ] **Step 2: Replicar em `create_conta_pagar`** (mesmo padrão, trocando `ContaReceber` por `ContaPagar`).

- [ ] **Step 3: Verificar manualmente criando 3 parcelas via curl**

```bash
curl -X POST http://localhost:8000/contas-receber/ \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"descricao":"Teste","cliente_id":"<id>","valor":300,"data_emissao":"2026-04-14","data_vencimento":"2026-05-12","total_parcelas":3,"intervalo_dias":28}'
```

Expected: response retorna 3 contas, todas com mesmo `grupo_parcelas_id`, vencimentos 12/05, 09/06, 07/07.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/conta_receber_service.py backend/app/services/conta_pagar_service.py
git commit -m "feat(service): grava grupo_parcelas_id e intervalo_dias no create"
```

---

## Task 5: Service — update com cascata

**Files:**
- Modify: `backend/app/services/conta_receber_service.py:97-135`
- Modify: `backend/app/services/conta_pagar_service.py:102-140`

- [ ] **Step 1: Atualizar `update_conta_receber` com cascata**

Substituir a função completa:

```python
async def update_conta_receber(
    db: AsyncSession, conta_id: uuid.UUID, data: ContaReceberUpdate
) -> ContaReceber:
    conta = await get_conta_receber_by_id(db, conta_id)

    update_data = data.model_dump(exclude_unset=True)
    recalcular = update_data.pop("recalcular_parcelas_futuras", False)

    was_paid = conta.status == "pago"
    new_status = update_data.get("status", conta.status)

    novo_vencimento = update_data.get("data_vencimento", conta.data_vencimento)
    novo_intervalo = update_data.get("intervalo_dias", conta.intervalo_dias)

    for field, value in update_data.items():
        setattr(conta, field, value)

    if not was_paid and new_status == "pago":
        if not conta.data_pagamento:
            conta.data_pagamento = date.today()
        existing_lanc = await db.execute(
            select(Lancamento).where(Lancamento.conta_receber_id == conta.id)
        )
        if not existing_lanc.scalar_one_or_none():
            lancamento = Lancamento(
                tipo="receita",
                descricao=f"Recebimento: {conta.descricao}",
                valor=conta.valor,
                data=conta.data_pagamento,
                conta_receber_id=conta.id,
            )
            db.add(lancamento)
    elif was_paid and new_status != "pago":
        result = await db.execute(
            select(Lancamento).where(Lancamento.conta_receber_id == conta.id)
        )
        for lanc in result.scalars().all():
            await db.delete(lanc)
        conta.data_pagamento = None

    if (
        recalcular
        and conta.parcela_atual == 1
        and conta.grupo_parcelas_id is not None
        and novo_intervalo is not None
    ):
        irmas_result = await db.execute(
            select(ContaReceber).where(
                and_(
                    ContaReceber.grupo_parcelas_id == conta.grupo_parcelas_id,
                    ContaReceber.parcela_atual > 1,
                    ContaReceber.status != "pago",
                )
            )
        )
        for irma in irmas_result.scalars().all():
            irma.data_vencimento = novo_vencimento + timedelta(
                days=novo_intervalo * (irma.parcela_atual - 1)
            )
            irma.intervalo_dias = novo_intervalo

    await db.flush()
    await db.refresh(conta)
    return conta
```

- [ ] **Step 2: Replicar em `update_conta_pagar`**

Mesma lógica, trocando `ContaReceber` por `ContaPagar` e `conta_receber_id` por `conta_pagar_id` nos lançamentos.

- [ ] **Step 3: Verificar cascata via curl**

Criar 3 parcelas (28 dias), depois editar a primeira mudando vencimento para `2026-05-20` e intervalo para `30` com `recalcular_parcelas_futuras=true`:

```bash
curl -X PUT http://localhost:8000/contas-receber/<id_parcela_1> \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"data_vencimento":"2026-05-20","intervalo_dias":30,"recalcular_parcelas_futuras":true}'
```

Expected: parcela 2 com vencimento `2026-06-19`, parcela 3 com `2026-07-19`.

Testar também: cascata com `recalcular_parcelas_futuras=false` não deve alterar parcelas 2 e 3. E editar a parcela 2 com a flag `true` também não deve afetar 1 ou 3 (só a própria 2).

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/conta_receber_service.py backend/app/services/conta_pagar_service.py
git commit -m "feat(service): cascata ao editar 1a parcela com recalcular_parcelas_futuras"
```

---

## Task 6: Frontend — helper `monthRange` e types

**Files:**
- Create: `frontend/src/lib/monthRange.ts`
- Modify: `frontend/src/types/index.ts:61-95`

- [ ] **Step 1: Criar o helper**

`frontend/src/lib/monthRange.ts`:

```typescript
export function getMonthRange(mes: number, ano: number): { inicio: string; fim: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${ano}-${pad(mes)}-01`,
    fim: `${ano}-${pad(mes)}-${pad(ultimoDia)}`,
  };
}

export function getCurrentMonth(): { mes: number; ano: number } {
  const hoje = new Date();
  return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };
}

export function shiftMonth(mes: number, ano: number, delta: number): { mes: number; ano: number } {
  const idx = (mes - 1) + delta;
  const novoAno = ano + Math.floor(idx / 12);
  const novoMes = ((idx % 12) + 12) % 12 + 1;
  return { mes: novoMes, ano: novoAno };
}

export function formatMonthLabel(mes: number, ano: number): string {
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${nomes[mes - 1]} / ${ano}`;
}
```

- [ ] **Step 2: Adicionar campos opcionais aos tipos**

Em `ContaReceber`, após `total_parcelas: number;` adicionar:

```typescript
  grupo_parcelas_id?: string;
  intervalo_dias?: number;
```

Idem em `ContaPagar`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/monthRange.ts frontend/src/types/index.ts
git commit -m "feat(frontend): helper monthRange e campos de grupo de parcelas nos types"
```

---

## Task 7: Frontend — componente `MonthNavigator`

**Files:**
- Create: `frontend/src/components/ui/MonthNavigator.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel, getCurrentMonth, shiftMonth } from '../../lib/monthRange';

interface MonthNavigatorProps {
  mes: number;
  ano: number;
  onChange: (mes: number, ano: number) => void;
}

export function MonthNavigator({ mes, ano, onChange }: MonthNavigatorProps) {
  const hoje = getCurrentMonth();
  const isAtual = mes === hoje.mes && ano === hoje.ano;

  const prev = () => { const r = shiftMonth(mes, ano, -1); onChange(r.mes, r.ano); };
  const next = () => { const r = shiftMonth(mes, ano, 1); onChange(r.mes, r.ano); };
  const hojeClick = () => onChange(hoje.mes, hoje.ano);

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-gray-200/60 rounded-md">
      <button onClick={prev} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-l-md transition-colors" aria-label="Mês anterior">
        <ChevronLeft size={16} />
      </button>
      <span className="px-3 py-2 text-[15px] font-semibold text-gray-700 min-w-[140px] text-center">
        {formatMonthLabel(mes, ano)}
      </span>
      <button onClick={next} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors" aria-label="Próximo mês">
        <ChevronRight size={16} />
      </button>
      {!isAtual && (
        <button onClick={hojeClick} className="px-3 py-2 text-[13px] font-medium text-[#1a2340] hover:bg-gray-50 rounded-r-md border-l border-gray-200/60 transition-colors">
          Hoje
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/MonthNavigator.tsx
git commit -m "feat(frontend): componente MonthNavigator"
```

---

## Task 8: Frontend — services aceitam `intervalo_dias` e `recalcular_parcelas_futuras`

**Files:**
- Modify: `frontend/src/services/contasReceber.ts:44`
- Modify: `frontend/src/services/contasPagar.ts:44`

- [ ] **Step 1: Estender payload de update em `contasReceber.ts`**

Substituir o método `update`:

```typescript
  async update(
    id: string,
    payload: Partial<ContaReceberPayload & { status: string; data_pagamento: string | null; recalcular_parcelas_futuras: boolean }>
  ): Promise<ContaReceber> {
    const { data } = await api.put<ContaReceber>(`/contas-receber/${id}`, payload);
    return data;
  },
```

- [ ] **Step 2: Idem em `contasPagar.ts`** — substituir o método `update` pelo análogo com `ContaPagarPayload`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/contasReceber.ts frontend/src/services/contasPagar.ts
git commit -m "feat(frontend): payload de update aceita intervalo e cascata"
```

---

## Task 9: Frontend — `ContasReceber.tsx` (mês + auto-cálculo + cascata)

**Files:**
- Modify: `frontend/src/pages/ContasReceber.tsx`

- [ ] **Step 1: Adicionar imports no topo**

Após os imports existentes:

```tsx
import { MonthNavigator } from '../components/ui/MonthNavigator';
import { getCurrentMonth, getMonthRange } from '../lib/monthRange';
```

- [ ] **Step 2: Adicionar estado de mês e do flag manual**

Logo abaixo de `const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);`:

```tsx
  const [mesAno, setMesAno] = useState(getCurrentMonth());
  const [vencimentoEditadoManual, setVencimentoEditadoManual] = useState(false);
  const [recalcularFuturas, setRecalcularFuturas] = useState(true);
  const [editingItem, setEditingItem] = useState<ContaReceber | null>(null);
```

- [ ] **Step 3: Atualizar `load` e `useEffect` para enviar range do mês**

Substituir o corpo de `load`:

```tsx
  const load = async () => {
    try {
      const { inicio, fim } = getMonthRange(mesAno.mes, mesAno.ano);
      const filters: Record<string, string> = { data_inicio: inicio, data_fim: fim };
      if (statusFilter) filters.status = statusFilter;
      const [contas, cls] = await Promise.all([
        contasReceberService.list(filters),
        clientesService.list(),
      ]);
      setItems(contas);
      setClientes(cls);
    } catch {
      toast('error', 'Erro ao carregar contas a receber');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, mesAno.mes, mesAno.ano]);
```

Remova o `useEffect` antigo que dependia apenas de `[statusFilter]`.

- [ ] **Step 4: Ajustar `openCreate` e `openEdit`**

Substituir:

```tsx
  const openCreate = () => {
    setEditingId(null);
    setEditingItem(null);
    setForm(emptyForm);
    setVencimentoEditadoManual(false);
    setRecalcularFuturas(true);
    setShowModal(true);
  };
  const openEdit = (c: ContaReceber) => {
    setEditingId(c.id);
    setEditingItem(c);
    setForm({
      descricao: c.descricao,
      cliente_id: c.cliente_id,
      ordem_producao_id: c.ordem_producao_id,
      valor: c.valor,
      data_emissao: c.data_emissao,
      data_vencimento: c.data_vencimento,
      intervalo_dias: c.intervalo_dias,
      observacoes: c.observacoes ?? '',
    });
    setVencimentoEditadoManual(true);
    setRecalcularFuturas(true);
    setShowModal(true);
  };
```

- [ ] **Step 5: Ajustar `handleSubmit` para enviar cascata**

Substituir a função:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim() || !form.cliente_id || submitting) return;
    setSubmitting(true);
    try {
      const payload = { ...form, valor: Number(form.valor) };
      if (editingId) {
        const podeCascata =
          editingItem?.parcela_atual === 1 && (editingItem?.total_parcelas ?? 1) > 1;
        await contasReceberService.update(editingId, {
          ...payload,
          ...(podeCascata ? { recalcular_parcelas_futuras: recalcularFuturas } : {}),
        });
        toast('success', 'Conta atualizada!');
      } else {
        const created = await contasReceberService.create(payload);
        toast('success', created.length > 1 ? `${created.length} parcelas criadas!` : 'Conta criada!');
      }
      closeModal();
      setIsLoading(true);
      load();
    } catch {
      toast('error', 'Erro ao salvar conta');
    } finally {
      setSubmitting(false);
    }
  };
```

- [ ] **Step 6: Adicionar `MonthNavigator` na UI**

No JSX, logo antes do bloco de cards de totais, adicionar:

```tsx
      <div className="flex items-center justify-between">
        <MonthNavigator mes={mesAno.mes} ano={mesAno.ano} onChange={(m, a) => { setMesAno({ mes: m, ano: a }); setIsLoading(true); }} />
      </div>
```

- [ ] **Step 7: Auto-cálculo do vencimento no cadastro**

Substituir o input de "Intervalo (dias)" (linha ~314):

```tsx
                    <input
                      type="number" min="0" max="365"
                      placeholder="Deixe vazio para mensal"
                      value={form.intervalo_dias ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const novoIntervalo = raw === '' ? undefined : parseInt(raw);
                        setForm((prev) => {
                          const next = { ...prev, intervalo_dias: novoIntervalo };
                          if (!editingId && !vencimentoEditadoManual && novoIntervalo !== undefined) {
                            const hoje = new Date();
                            hoje.setDate(hoje.getDate() + novoIntervalo);
                            next.data_vencimento = hoje.toISOString().slice(0, 10);
                          }
                          return next;
                        });
                      }}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
```

E no input de "1º Vencimento" (linha ~301):

```tsx
                  <input
                    type="date" required
                    value={form.data_vencimento}
                    onChange={(e) => {
                      setVencimentoEditadoManual(true);
                      setForm({ ...form, data_vencimento: e.target.value });
                    }}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300 transition-colors" />
```

- [ ] **Step 8: Intervalo visível na edição + checkbox de cascata**

Remover o guard `{!editingId && ...}` que esconde o grid de parcelas/intervalo. Manter o grid sempre, mas **desabilitar** o campo `total_parcelas` quando `editingId` estiver setado (parcelas não se remontam) e mostrar apenas o campo `intervalo_dias` editável.

Substituir o bloco que hoje está entre `{!editingId && (` e o fechamento da seção do preview por:

```tsx
              {!editingId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[14px] font-medium text-gray-500 mb-1">Parcelas</label>
                    <input type="number" min="1" max="48" value={form.total_parcelas || 1} onChange={(e) => setForm({ ...form, total_parcelas: parseInt(e.target.value) || 1 })}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-gray-500 mb-1">Intervalo (dias)</label>
                    <input type="number" min="0" max="365" placeholder="Deixe vazio para mensal" value={form.intervalo_dias ?? ''} onChange={(e) => {
                      const raw = e.target.value;
                      const novoIntervalo = raw === '' ? undefined : parseInt(raw);
                      setForm((prev) => {
                        const next = { ...prev, intervalo_dias: novoIntervalo };
                        if (!vencimentoEditadoManual && novoIntervalo !== undefined) {
                          const hoje = new Date();
                          hoje.setDate(hoje.getDate() + novoIntervalo);
                          next.data_vencimento = hoje.toISOString().slice(0, 10);
                        }
                        return next;
                      });
                    }}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
                  </div>
                </div>
              )}
              {editingId && (
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Intervalo (dias)</label>
                  <input type="number" min="0" max="365" placeholder="Deixe vazio para mensal" value={form.intervalo_dias ?? ''} onChange={(e) => setForm({ ...form, intervalo_dias: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
                </div>
              )}
              {editingId && editingItem?.parcela_atual === 1 && (editingItem?.total_parcelas ?? 1) > 1 && (
                <label className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={recalcularFuturas} onChange={(e) => setRecalcularFuturas(e.target.checked)} className="mt-0.5" />
                  <span className="text-[13px] text-amber-800">
                    <span className="font-semibold">Recalcular parcelas futuras (2..{editingItem?.total_parcelas}).</span>{' '}
                    As próximas parcelas serão recalculadas com o novo 1º vencimento e intervalo. Parcelas já pagas são mantidas.
                  </span>
                </label>
              )}
```

- [ ] **Step 9: Verificação manual**

Rodar `cd frontend && npm run dev`, acessar `/contas-receber`. Testar:
1. Página abre no mês atual; navegar com `◀` / `▶` atualiza a lista; "Hoje" reaparece ao sair do mês atual e volta quando clicado.
2. Nova conta com intervalo 28 → "1º Vencimento" preenche hoje+28.
3. Alterar vencimento manualmente → digitar novo intervalo não sobrescreve.
4. Editar parcela 1/3: checkbox "Recalcular parcelas futuras" aparece, mudar vencimento+intervalo propaga para 2/3 e 3/3.
5. Editar parcela 2/3: checkbox não aparece; só a própria parcela muda.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/ContasReceber.tsx
git commit -m "feat(contas-receber): navegacao mensal, auto-calculo de vencimento e cascata"
```

---

## Task 10: Frontend — `ContasPagar.tsx`

**Files:**
- Modify: `frontend/src/pages/ContasPagar.tsx`

Aplicar **exatamente** o mesmo padrão da Task 9, com estas diferenças:
- Usa `contasPagarService` e tipo `ContaPagar`.
- Mantém o filtro `categoria` existente.
- Filtros passam a incluir `data_inicio`/`data_fim` calculados por `getMonthRange`.

- [ ] **Step 1: Imports**

```tsx
import { MonthNavigator } from '../components/ui/MonthNavigator';
import { getCurrentMonth, getMonthRange } from '../lib/monthRange';
```

- [ ] **Step 2: Estados adicionais** (abaixo de `undoConfirmId`):

```tsx
  const [mesAno, setMesAno] = useState(getCurrentMonth());
  const [vencimentoEditadoManual, setVencimentoEditadoManual] = useState(false);
  const [recalcularFuturas, setRecalcularFuturas] = useState(true);
  const [editingItem, setEditingItem] = useState<ContaPagar | null>(null);
```

- [ ] **Step 3: `load` com range do mês**

```tsx
  const load = async () => {
    try {
      const { inicio, fim } = getMonthRange(mesAno.mes, mesAno.ano);
      const filters: Record<string, string> = { data_inicio: inicio, data_fim: fim };
      if (statusFilter) filters.status = statusFilter;
      if (catFilter) filters.categoria = catFilter;
      const [contas, forns] = await Promise.all([
        contasPagarService.list(filters),
        fornecedoresService.list(),
      ]);
      setItems(contas);
      setFornecedores(forns);
    } catch {
      toast('error', 'Erro ao carregar contas a pagar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, catFilter, mesAno.mes, mesAno.ano]);
```

- [ ] **Step 4: `openCreate`, `openEdit`, `handleSubmit`, `MonthNavigator`, inputs com auto-cálculo e checkbox de cascata**

Reproduzir os passos 4–8 da Task 9, substituindo `ContaReceber` por `ContaPagar` e preservando `categoria` no form.

- [ ] **Step 5: Verificação manual**

Repetir os cenários da Task 9 (step 9) em `/contas-pagar`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ContasPagar.tsx
git commit -m "feat(contas-pagar): navegacao mensal, auto-calculo de vencimento e cascata"
```

---

## Task 11: Frontend — `Lancamentos.tsx` (navegação mensal)

**Files:**
- Modify: `frontend/src/pages/Lancamentos.tsx:22-50`

- [ ] **Step 1: Substituir os estados `dataInicio`/`dataFim` por `mesAno`**

Remover:
```tsx
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
```

Adicionar:
```tsx
  const [mesAno, setMesAno] = useState(getCurrentMonth());
```

E imports:
```tsx
import { MonthNavigator } from '../components/ui/MonthNavigator';
import { getCurrentMonth, getMonthRange } from '../lib/monthRange';
```

- [ ] **Step 2: Atualizar `load`**

```tsx
  const load = async () => {
    try {
      const { inicio, fim } = getMonthRange(mesAno.mes, mesAno.ano);
      const filters: Record<string, string> = { data_inicio: inicio, data_fim: fim };
      if (tipoFilter) filters.tipo = tipoFilter;

      const [lancs, res] = await Promise.all([
        lancamentosService.list(filters),
        lancamentosService.resumo({ data_inicio: inicio, data_fim: fim }),
      ]);
      setItems(lancs);
      setResumo(res);
    } catch {
      toast('error', 'Erro ao carregar lançamentos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [tipoFilter, mesAno.mes, mesAno.ano]);
```

- [ ] **Step 3: Substituir a UI de filtros de data**

Localizar os inputs `type="date"` de `dataInicio`/`dataFim` e substituí-los pelo `<MonthNavigator mes={mesAno.mes} ano={mesAno.ano} onChange={(m,a) => { setMesAno({ mes: m, ano: a }); setIsLoading(true); }} />` na mesma linha dos filtros.

- [ ] **Step 4: Verificação manual**

Acessar `/lancamentos`: abre no mês atual, navegação funciona, totalizadores refletem o mês.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Lancamentos.tsx
git commit -m "feat(lancamentos): navegacao mensal substitui range manual"
```

---

## Self-Review (pós-plano)

Cobertura do spec:

- **Bloco 1 (navegação mensal):** Tasks 6, 7, 9 (step 6), 10 (step 4), 11.
- **Bloco 2 (1º vencimento = hoje + intervalo):** Task 9 (step 7), replicada na 10.
- **Bloco 3 (edição com cascata):** Tasks 1–5 (backend), 8 (service frontend), 9 (step 8), replicada na 10.

Tipos consistentes: `grupo_parcelas_id` (UUID/string), `intervalo_dias` (int/number), `recalcular_parcelas_futuras` (bool) — nomes idênticos em schema, service, migration e frontend.

Sem placeholders nem "similar ao anterior" sem código — Task 10 e 11 referenciam a 9, mas os steps concretos estão documentados na própria 9 e os ajustes específicos (categoria, tipo) estão listados.
