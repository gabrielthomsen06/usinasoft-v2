import { useEffect, useState } from 'react';
import { Plus, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { lancamentosService, LancamentoPayload } from '../services/lancamentos';
import { Lancamento, ResumoFinanceiro } from '../types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const emptyForm: LancamentoPayload = {
  tipo: 'receita', descricao: '', valor: 0, data: new Date().toISOString().slice(0, 10), observacoes: '',
};

export function Lancamentos() {
  const { toast } = useToast();
  const [items, setItems] = useState<Lancamento[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro>({ total_receitas: 0, total_despesas: 0, saldo: 0 });
  const [tipoFilter, setTipoFilter] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<LancamentoPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const filters: Record<string, string> = {};
      if (tipoFilter) filters.tipo = tipoFilter;
      if (dataInicio) filters.data_inicio = dataInicio;
      if (dataFim) filters.data_fim = dataFim;

      const [lancs, res] = await Promise.all([
        lancamentosService.list(Object.keys(filters).length ? filters : undefined),
        lancamentosService.resumo(dataInicio || dataFim ? { data_inicio: dataInicio || undefined, data_fim: dataFim || undefined } : undefined),
      ]);
      setItems(lancs);
      setResumo(res);
    } catch {
      toast('error', 'Erro ao carregar lançamentos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [tipoFilter, dataInicio, dataFim]);

  // Group by date
  const grouped = items.reduce<Record<string, Lancamento[]>>((acc, l) => {
    const key = l.data;
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const openCreate = () => { setForm(emptyForm); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setForm(emptyForm); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim() || submitting) return;
    setSubmitting(true);
    try {
      await lancamentosService.create({ ...form, valor: Number(form.valor) });
      toast('success', 'Lançamento criado!');
      closeModal();
      setIsLoading(true);
      load();
    } catch {
      toast('error', 'Erro ao criar lançamento');
    } finally {
      setSubmitting(false);
    }
  };

  const tipoFilters = ['', 'receita', 'despesa'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Lançamentos</h1>
          <p className="text-[14px] text-gray-400 mt-0.5">Movimentações financeiras</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-[#1a2340] text-white px-3.5 py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors">
          <Plus size={14} /> Novo Lançamento
        </button>
      </div>

      {/* Summary */}
      <div className="bg-white border border-gray-200/60 rounded-lg p-4">
        <p className="text-[13px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Resumo do Período</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[13px] text-gray-400">Entradas</p>
            <p className="text-[20px] font-bold text-emerald-600">{formatCurrency(resumo.total_receitas)}</p>
          </div>
          <div>
            <p className="text-[13px] text-gray-400">Saídas</p>
            <p className="text-[20px] font-bold text-red-500">{formatCurrency(resumo.total_despesas)}</p>
          </div>
          <div>
            <p className="text-[13px] text-gray-400">Saldo</p>
            <p className={`text-[20px] font-bold ${resumo.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(resumo.saldo)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5">
          {tipoFilters.map((t) => (
            <button key={t || 'all'} onClick={() => { setTipoFilter(t); setIsLoading(true); }}
              className={`px-3 py-2 rounded-md text-[14px] font-medium transition-colors ${tipoFilter === t ? 'bg-[#1a2340] text-white' : 'bg-white border border-gray-200/60 text-gray-500 hover:bg-gray-50'}`}>
              {t === 'receita' ? 'Entradas' : t === 'despesa' ? 'Saídas' : 'Todos'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setIsLoading(true); }}
            className="bg-white border border-gray-200/60 rounded-md px-3 py-2 text-[14px] text-gray-700 focus:outline-none focus:border-gray-300 transition-colors" />
          <span className="flex items-center text-gray-300 text-[14px]">até</span>
          <input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setIsLoading(true); }}
            className="bg-white border border-gray-200/60 rounded-md px-3 py-2 text-[14px] text-gray-700 focus:outline-none focus:border-gray-300 transition-colors" />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white border border-gray-200/60 rounded-lg flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="bg-white border border-gray-200/60 rounded-lg flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-[15px] text-gray-400">Nenhum lançamento encontrado</p>
          </div>
        ) : (
          sortedDates.map((dateKey) => (
            <div key={dateKey} className="bg-white border border-gray-200/60 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                <p className="text-[14px] font-semibold text-[#1C2D5A]">{formatDate(dateKey)}</p>
              </div>
              <div>
                {grouped[dateKey].map((l, i) => (
                  <div key={l.id} className={`flex items-center gap-3 px-4 py-3 ${i < grouped[dateKey].length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50/50 transition-colors`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${l.tipo === 'receita' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {l.tipo === 'receita' ? <ArrowDownLeft size={14} className="text-emerald-600" /> : <ArrowUpRight size={14} className="text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-gray-900 truncate">{l.descricao}</p>
                      <p className="text-[13px] text-gray-400">{l.tipo === 'receita' ? 'Entrada' : 'Saída'}</p>
                    </div>
                    <p className={`text-[16px] font-semibold whitespace-nowrap ${l.tipo === 'receita' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {l.tipo === 'receita' ? '+' : '-'} {formatCurrency(l.valor)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-[16px] font-semibold text-gray-900">Novo Lançamento</h2>
              <button onClick={closeModal} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Tipo <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  {(['receita', 'despesa'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, tipo: t })}
                      className={`flex-1 py-2 rounded-md text-[15px] font-medium transition-colors border ${form.tipo === t
                        ? t === 'receita' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-red-50 border-red-300 text-red-700'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                      {t === 'receita' ? 'Entrada' : 'Saída'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Descrição <span className="text-red-400">*</span></label>
                <input type="text" required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Valor <span className="text-red-400">*</span></label>
                  <input type="number" required step="0.01" min="0" value={form.valor || ''} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Data <span className="text-red-400">*</span></label>
                  <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} placeholder="Observações..."
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors resize-none" />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-[#1a2340] text-white py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors disabled:opacity-50">
                  {submitting ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
