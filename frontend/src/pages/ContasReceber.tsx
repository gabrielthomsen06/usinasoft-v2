import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Search, CheckCircle, RotateCcw } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { contasReceberService, ContaReceberPayload } from '../services/contasReceber';
import { clientesService } from '../services/clientes';
import { ContaReceber, Cliente } from '../types';
import { MonthNavigator } from '../components/ui/MonthNavigator';
import { getCurrentMonth, getMonthRange } from '../lib/monthRange';

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-50' },
  pago: { label: 'Pago', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  vencido: { label: 'Vencido', color: 'text-red-700', bg: 'bg-red-50' },
  cancelado: { label: 'Cancelado', color: 'text-gray-500', bg: 'bg-gray-100' },
};

const emptyForm: ContaReceberPayload = {
  descricao: '', cliente_id: '', valor: 0, data_emissao: new Date().toISOString().slice(0, 10), data_vencimento: '', total_parcelas: 1, intervalo_dias: undefined, observacoes: '',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ContasReceber() {
  const { toast } = useToast();
  const [items, setItems] = useState<ContaReceber[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContaReceberPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);
  const [mesAno, setMesAno] = useState(getCurrentMonth());
  const [vencimentoEditadoManual, setVencimentoEditadoManual] = useState(false);
  const [recalcularFuturas, setRecalcularFuturas] = useState(true);
  const [editingItem, setEditingItem] = useState<ContaReceber | null>(null);

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

  const filtered = items.filter((c) => {
    const q = search.toLowerCase();
    return c.descricao.toLowerCase().includes(q) || (c.cliente?.nome ?? '').toLowerCase().includes(q);
  });

  const totals = {
    total: items.reduce((s, c) => s + c.valor, 0),
    pendente: items.filter((c) => c.status === 'pendente').reduce((s, c) => s + c.valor, 0),
    pago: items.filter((c) => c.status === 'pago').reduce((s, c) => s + c.valor, 0),
    vencido: items.filter((c) => c.status === 'vencido').reduce((s, c) => s + c.valor, 0),
  };

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
  const closeModal = () => { setShowModal(false); setForm(emptyForm); setEditingId(null); };

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

  const handleMarkPaid = async (id: string) => {
    try {
      await contasReceberService.update(id, { status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) });
      toast('success', 'Conta marcada como paga!');
      setIsLoading(true);
      load();
    } catch {
      toast('error', 'Erro ao atualizar conta');
    }
  };

  const handleUndoPayment = async (id: string) => {
    try {
      await contasReceberService.update(id, { status: 'pendente', data_pagamento: null });
      toast('success', 'Pagamento desfeito!');
      setUndoConfirmId(null);
      setIsLoading(true);
      load();
    } catch {
      toast('error', 'Erro ao desfazer pagamento');
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await contasReceberService.remove(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      toast('success', 'Conta removida!');
    } catch {
      toast('error', 'Erro ao remover conta');
    } finally {
      setDeletingId(null);
    }
  };

  const statusFilters = ['', 'pendente', 'pago', 'vencido', 'cancelado'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Contas a Receber</h1>
          <p className="text-[14px] text-gray-400 mt-0.5">{items.length} contas</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-[#1a2340] text-white px-3.5 py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors">
          <Plus size={14} /> Nova Conta
        </button>
      </div>

      <div className="flex items-center justify-between">
        <MonthNavigator mes={mesAno.mes} ano={mesAno.ano} onChange={(m, a) => { setMesAno({ mes: m, ano: a }); setIsLoading(true); }} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: totals.total, border: 'border-l-blue-500' },
          { label: 'Pendente', value: totals.pendente, border: 'border-l-amber-500' },
          { label: 'Recebido', value: totals.pago, border: 'border-l-emerald-500' },
          { label: 'Vencido', value: totals.vencido, border: 'border-l-red-500' },
        ].map((card) => (
          <div key={card.label} className={`bg-white border border-gray-200/60 rounded-lg p-3.5 border-l-4 ${card.border}`}>
            <p className="text-[13px] text-gray-400 font-medium">{card.label}</p>
            <p className="text-[18px] font-bold text-gray-900 mt-0.5">{formatCurrency(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input type="text" placeholder="Buscar por descrição ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200/60 rounded-md text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
        </div>
        <div className="flex gap-1.5">
          {statusFilters.map((s) => (
            <button key={s || 'all'} onClick={() => { setStatusFilter(s); setIsLoading(true); }}
              className={`px-3 py-2 rounded-md text-[14px] font-medium transition-colors ${statusFilter === s ? 'bg-[#1a2340] text-white' : 'bg-white border border-gray-200/60 text-gray-500 hover:bg-gray-50'}`}>
              {s ? statusLabels[s]?.label : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200/60 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-[15px] text-gray-400">{search ? 'Nenhuma conta encontrada' : 'Nenhuma conta cadastrada'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Descrição</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-400 uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Vencimento</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const st = statusLabels[c.status] || statusLabels.pendente;
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <td className="px-4 py-2.5 text-[15px] font-medium text-gray-900 max-w-[200px]">
                        <span className="truncate block">{c.descricao}</span>
                        {c.total_parcelas > 1 && (
                          <span className="text-[12px] text-gray-400 font-medium">Parcela {c.parcela_atual}/{c.total_parcelas}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[15px] text-gray-500">{c.cliente?.nome ?? '—'}</td>
                      <td className="px-4 py-2.5 text-[15px] font-semibold text-gray-900 text-right">{formatCurrency(c.valor)}</td>
                      <td className="px-4 py-2.5 text-[15px] text-gray-500 hidden md:table-cell">{new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[13px] font-semibold ${st.color} ${st.bg}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          {c.status === 'pendente' && (
                            <button onClick={() => handleMarkPaid(c.id)} className="p-1.5 text-gray-300 hover:text-emerald-600 rounded transition-colors" title="Marcar como pago">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {c.status === 'pago' && (
                            <button onClick={() => setUndoConfirmId(c.id)} className="p-1.5 text-gray-300 hover:text-amber-600 rounded transition-colors" title="Desfazer pagamento">
                              <RotateCcw size={14} />
                            </button>
                          )}
                          <button onClick={() => openEdit(c)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded transition-colors" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors disabled:opacity-50" title="Excluir"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Undo payment confirmation */}
      {undoConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-[16px] font-semibold text-gray-900">Desfazer pagamento?</h2>
            </div>
            <div className="px-5 py-4">
              <p className="text-[14px] text-gray-600">Tem certeza que deseja desfazer o pagamento desta conta? O lançamento correspondente será removido do fluxo de caixa.</p>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2.5">
              <button onClick={() => setUndoConfirmId(null)} className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={() => handleUndoPayment(undoConfirmId)} className="flex-1 bg-amber-600 text-white py-2 rounded-md text-[15px] font-medium hover:bg-amber-700 transition-colors">Desfazer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-[16px] font-semibold text-gray-900">{editingId ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}</h2>
              <button onClick={closeModal} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Descrição <span className="text-red-400">*</span></label>
                <input type="text" required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição da conta"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Cliente <span className="text-red-400">*</span></label>
                  <select required value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300 transition-colors">
                    <option value="">Selecione...</option>
                    {clientes.map((cl) => <option key={cl.id} value={cl.id}>{cl.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Valor Total <span className="text-red-400">*</span></label>
                  <input type="number" required step="0.01" min="0" value={form.valor || ''} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Data Emissão</label>
                  <input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300 transition-colors" />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">1º Vencimento <span className="text-red-400">*</span></label>
                  <input
                    type="date" required
                    value={form.data_vencimento}
                    onChange={(e) => {
                      setVencimentoEditadoManual(true);
                      setForm({ ...form, data_vencimento: e.target.value });
                    }}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300 transition-colors" />
                </div>
              </div>
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
              {!editingId && (form.total_parcelas ?? 1) > 1 && form.valor > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
                  <p className="text-[13px] text-blue-700 font-medium">
                    {form.total_parcelas}x de {formatCurrency(Math.round((form.valor / (form.total_parcelas ?? 1)) * 100) / 100)}
                    {' — '}
                    {form.intervalo_dias !== undefined
                      ? `Vencimentos a cada ${form.intervalo_dias} dias`
                      : 'Vencimentos mensais'}
                    {' a partir de '}
                    {form.data_vencimento ? new Date(form.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '...'}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} placeholder="Observações..."
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors resize-none" />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-[#1a2340] text-white py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors disabled:opacity-50">
                  {submitting ? 'Salvando...' : editingId ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
