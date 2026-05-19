# Confirmação de exclusão e ordenação por vencimento — Design

**Data:** 2026-05-19
**Status:** Aprovado (aguardando revisão final do usuário)

## Contexto

O dono da empresa pediu dois ajustes pequenos em Contas a Pagar e Contas a Receber:

1. **Confirmação antes de excluir** — hoje o botão da lixeira na tabela exclui a conta imediatamente, sem pedir confirmação. Risco de exclusão acidental.
2. **Ordenação por vencimento ascendente** — hoje a tabela mostra os vencimentos mais recentes no topo. Para controle de parcelas, a ordem ascendente (mais antigo primeiro) é mais útil, já que mostra o que está próximo de vencer.

Ambas as mudanças aplicam aos dois módulos (Pagar e Receber) com código simétrico.

## Decisões pré-aprovadas

- **Confirmação:** reaproveitar o exato padrão de modal já usado para "Desfazer pagamento" em `ContasReceber.tsx` (linhas 287-300). Mesma estrutura, texto diferente.
- **Ordenação:** ordem pura por `data_vencimento.asc()` no backend, sem agrupar por status (opção A do brainstorm).

## Mudanças

### 1. Modal de confirmação ao excluir

**Frontend (idêntico em duas páginas):**
- `frontend/src/pages/ContasReceber.tsx`
- `frontend/src/pages/ContasPagar.tsx`

**Mudanças por arquivo:**

- Adicionar novo state: `const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);`
- No botão da lixeira (lá pelas linhas 275/301), trocar `onClick={() => handleDelete(c.id)}` por `onClick={() => setDeleteConfirmId(c.id)}`
- Adicionar um novo bloco JSX de modal de confirmação, copiando o estilo do bloco existente de "Desfazer pagamento". Texto:
  - Título: `"Excluir esta conta?"`
  - Corpo: `"Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita."`
  - Botão cancelar (cinza): `"Cancelar"` → `setDeleteConfirmId(null)`
  - Botão confirmar (vermelho `bg-red-600 hover:bg-red-700`): `"Excluir"` → chama `handleDelete(deleteConfirmId)` e fecha o modal
- `handleDelete` em si **não muda** — continua aceitando o id e chamando `contasReceberService.remove(id)` / `contasPagarService.remove(id)`.

Comportamento de parcelamento permanece: o backend já remove apenas a parcela específica (não o grupo todo). O modal só pede confirmação, sem mudar lógica.

### 2. Ordenação por vencimento ascendente

**Backend:**
- `backend/app/services/conta_receber_service.py:58`
- `backend/app/services/conta_pagar_service.py:62`

**Mudança:** trocar `.order_by(ContaXxx.data_vencimento.desc())` por `.order_by(ContaXxx.data_vencimento.asc())` em ambos os services.

**Tiebreaker:** quando duas contas têm o mesmo `data_vencimento`, manter a ordem secundária por `created_at.asc()` (ou pelo id, se created_at não está garantido — investigar no implementação). Isso evita reordenação aleatória entre requests.

## Critérios de aceitação

1. Clicar na lixeira em uma conta abre o modal de confirmação; clicar "Cancelar" fecha sem excluir; clicar "Excluir" chama a API de delete e atualiza a lista.
2. A tabela de Contas a Receber lista as contas do mais antigo vencimento para o mais recente.
3. Mesma coisa em Contas a Pagar.
4. Contas com mesma data de vencimento aparecem em ordem estável entre recarregamentos.
5. Os testes existentes do backend (`test_contas_receber.py`, `test_contas_pagar.py`) continuam passando — se algum teste assumir ordem decrescente, é ajustado.

## Out of scope

- Não mudar o agrupamento por status na ordenação (já decidido — opção A)
- Não adicionar undo após exclusão
- Não permitir reverter o sort para descendente (manter simples — uma direção fixa)
- Não tocar em outras telas (Lançamentos, Dashboard, etc.)
