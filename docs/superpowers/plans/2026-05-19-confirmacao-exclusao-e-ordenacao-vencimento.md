# Confirmação de exclusão e ordenação por vencimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar modal de confirmação antes de excluir conta (em Pagar e Receber) e inverter a ordenação padrão da listagem para `data_vencimento` ascendente, com `created_at` como tiebreaker.

**Architecture:** Frontend reaproveita o padrão de modal de confirmação já existente (usado em "Desfazer pagamento"). Backend troca `.desc()` por `.asc()` em dois services e adiciona segundo critério de ordenação (`created_at.asc()`).

**Tech Stack:** React + TypeScript (frontend), FastAPI + SQLAlchemy 2 async (backend), pytest

**Reference spec:** [`docs/superpowers/specs/2026-05-19-confirmacao-exclusao-e-ordenacao-vencimento-design.md`](../specs/2026-05-19-confirmacao-exclusao-e-ordenacao-vencimento-design.md)

---

## Task 1: Backend — ordenação ascendente por vencimento

**Files:**
- Modify: `backend/app/services/conta_receber_service.py:58`
- Modify: `backend/app/services/conta_pagar_service.py:62`
- Test (run): `backend/tests/test_contas_receber.py`, `backend/tests/test_contas_pagar.py`

- [ ] **Step 1: Rodar a suite atual e capturar o estado verde**

```powershell
& "C:\Users\gabri\usinasoft-v2\backend\venv\Scripts\Activate.ps1"
cd C:\Users\gabri\usinasoft-v2\backend
pytest tests/test_contas_receber.py tests/test_contas_pagar.py -v
```

Anote quantos testes passam e se algum já assume ordem decrescente. Se algum teste passar verificando "primeiro item = vencimento mais recente", esse teste vai quebrar no step 4 e precisa ser ajustado em step 5.

- [ ] **Step 2: Alterar ordenação em `conta_receber_service.py`**

No arquivo `backend/app/services/conta_receber_service.py`, linha ~58, trocar:

```python
query = query.order_by(ContaReceber.data_vencimento.desc()).offset(skip).limit(limit)
```

por:

```python
query = query.order_by(
    ContaReceber.data_vencimento.asc(),
    ContaReceber.created_at.asc(),
).offset(skip).limit(limit)
```

- [ ] **Step 3: Alterar ordenação em `conta_pagar_service.py`**

No arquivo `backend/app/services/conta_pagar_service.py`, linha ~62, trocar:

```python
query = query.order_by(ContaPagar.data_vencimento.desc()).offset(skip).limit(limit)
```

por:

```python
query = query.order_by(
    ContaPagar.data_vencimento.asc(),
    ContaPagar.created_at.asc(),
).offset(skip).limit(limit)
```

Verificar antes que `ContaPagar` tem `created_at` (deve ter, mas confirmar lendo `backend/app/models/conta_pagar.py`).

- [ ] **Step 4: Rodar a suite e ver quais testes quebram**

```powershell
pytest tests/test_contas_receber.py tests/test_contas_pagar.py -v
```

Testes que assumem ordem decrescente vão falhar com algo tipo `assert items[0].data_vencimento == date(2026, X, Y)` onde X é um mês recente.

- [ ] **Step 5: Ajustar testes que assumem ordem descendente**

Para cada teste que quebrou no step 4:
- Se ele só verifica que a lista veio com algum item específico, não precisa mudar.
- Se ele assume ordem específica de items no array (ex: `items[0]` é a mais recente), inverter o índice (`items[-1]` para o mais recente) ou ajustar para refletir a nova ordem ascendente.
- Adicionar comentário curto explicando que a ordenação padrão agora é ascendente.

Roda novamente:

```powershell
pytest tests/test_contas_receber.py tests/test_contas_pagar.py -v
```

Esperado: todos os testes passam.

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\gabri\usinasoft-v2
git add backend/app/services/conta_receber_service.py backend/app/services/conta_pagar_service.py backend/tests/test_contas_receber.py backend/tests/test_contas_pagar.py
git commit -m "feat(contas): order list by vencimento ascending (created_at as tiebreaker)"
```

---

## Task 2: Frontend — modal de confirmação ao excluir (Contas a Receber)

**Files:**
- Modify: `frontend/src/pages/ContasReceber.tsx`

Estratégia: copiar o padrão exato do modal "Desfazer pagamento" que já está no arquivo (linhas ~287-300).

- [ ] **Step 1: Adicionar state `deleteConfirmId`**

No bloco de useState (próximo da linha 37-43 onde estão `deletingId`, `undoConfirmId`, etc.), adicionar:

```tsx
const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
```

- [ ] **Step 2: Trocar o onClick do botão da lixeira**

Encontrar o botão da lixeira (linha ~275):

```tsx
<button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="..." title="Excluir"><Trash2 size={14} /></button>
```

Trocar `onClick` para abrir o modal:

```tsx
<button onClick={() => setDeleteConfirmId(c.id)} disabled={deletingId === c.id} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors disabled:opacity-50" title="Excluir"><Trash2 size={14} /></button>
```

- [ ] **Step 3: Adicionar bloco do modal de confirmação**

Logo após o bloco do modal "Desfazer pagamento" (que termina por volta da linha 305 com `</div>` e `)}`), adicionar:

```tsx
{/* Delete confirmation */}
{deleteConfirmId && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
    <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-[16px] font-semibold text-gray-900">Excluir esta conta?</h2>
      </div>
      <div className="px-5 py-4">
        <p className="text-[14px] text-gray-600">Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.</p>
      </div>
      <div className="px-5 py-3 border-t border-gray-100 flex gap-2.5">
        <button onClick={() => setDeleteConfirmId(null)} className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
        <button onClick={() => { const id = deleteConfirmId; setDeleteConfirmId(null); handleDelete(id); }} className="flex-1 bg-red-600 text-white py-2 rounded-md text-[15px] font-medium hover:bg-red-700 transition-colors">Excluir</button>
      </div>
    </div>
  </div>
)}
```

Note que o botão "Excluir" captura o id em variável local antes de fechar o modal — evita race condition se `handleDelete` lê do state `deleteConfirmId` depois do `setDeleteConfirmId(null)`.

- [ ] **Step 4: Build TypeScript**

```powershell
cd C:\Users\gabri\usinasoft-v2\frontend
npm run build
```

Expected: build OK, zero erros TS.

- [ ] **Step 5: Smoke check rápido (opcional, se já estiver com `npm run dev` rodando)**

No navegador, em Contas a Receber, clica na lixeira de qualquer conta de teste. Deve abrir o modal. Cancelar fecha sem deletar. Excluir remove a conta.

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\gabri\usinasoft-v2
git add frontend/src/pages/ContasReceber.tsx
git commit -m "feat(receber): confirm dialog before deleting conta"
```

---

## Task 3: Frontend — modal de confirmação ao excluir (Contas a Pagar)

**Files:**
- Modify: `frontend/src/pages/ContasPagar.tsx`

Mesma mudança da Task 2, aplicada ao arquivo de Pagar. A estrutura do arquivo é simétrica.

- [ ] **Step 1: Adicionar state `deleteConfirmId`**

Próximo à linha 51 (onde está `deletingId`), adicionar:

```tsx
const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
```

- [ ] **Step 2: Trocar o onClick do botão da lixeira**

Encontrar o botão da lixeira (linha ~301):

```tsx
<button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="..." title="Excluir"><Trash2 size={14} /></button>
```

Trocar para:

```tsx
<button onClick={() => setDeleteConfirmId(c.id)} disabled={deletingId === c.id} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors disabled:opacity-50" title="Excluir"><Trash2 size={14} /></button>
```

- [ ] **Step 3: Adicionar bloco do modal de confirmação**

Procurar o bloco do modal "Desfazer pagamento" (semelhante ao do receber). Logo depois dele, adicionar:

```tsx
{/* Delete confirmation */}
{deleteConfirmId && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
    <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-[16px] font-semibold text-gray-900">Excluir esta conta?</h2>
      </div>
      <div className="px-5 py-4">
        <p className="text-[14px] text-gray-600">Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.</p>
      </div>
      <div className="px-5 py-3 border-t border-gray-100 flex gap-2.5">
        <button onClick={() => setDeleteConfirmId(null)} className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
        <button onClick={() => { const id = deleteConfirmId; setDeleteConfirmId(null); handleDelete(id); }} className="flex-1 bg-red-600 text-white py-2 rounded-md text-[15px] font-medium hover:bg-red-700 transition-colors">Excluir</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Build TypeScript**

```powershell
cd C:\Users\gabri\usinasoft-v2\frontend
npm run build
```

Expected: build OK.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\gabri\usinasoft-v2
git add frontend/src/pages/ContasPagar.tsx
git commit -m "feat(pagar): confirm dialog before deleting conta"
```

---

## Task 4: Smoke test manual

- [ ] **Step 1: Restartar backend e frontend localmente**

Reinicia o uvicorn (vai pegar os services novos) e o vite (vai pegar o build novo do React).

- [ ] **Step 2: Validar no navegador**

Em Contas a Receber e em Contas a Pagar:

- [ ] Lista vem ordenada do vencimento mais antigo para o mais recente (topo = mais antigo)
- [ ] Clicar na lixeira abre modal "Excluir esta conta?"
- [ ] Botão Cancelar fecha sem excluir, conta permanece na lista
- [ ] Botão Excluir remove a conta e toast "Conta removida!" aparece
- [ ] Mesmo comportamento na outra tela

---

## Critérios de aceitação (do spec)

1. ✅ Lixeira abre modal de confirmação; cancelar fecha; excluir remove (Tasks 2, 3)
2. ✅ Contas a Receber listadas em ordem ascendente de vencimento (Task 1)
3. ✅ Contas a Pagar listadas em ordem ascendente de vencimento (Task 1)
4. ✅ Tiebreaker `created_at.asc()` garante ordem estável (Task 1, steps 2-3)
5. ✅ Testes backend continuam passando após ajuste se necessário (Task 1, steps 4-5)
