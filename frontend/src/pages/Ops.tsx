import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { opsService, OPPayload } from '../services/ops';
import { clientesService } from '../services/clientes';
import { OrdemProducao, Cliente, Peca } from '../types';

const emptyForm: OPPayload = {
  codigo: '',
  cliente_id: '',
  status: 'aberta',
  observacoes: '',
};

const statusOptions: { value: OrdemProducao['status']; label: string }[] = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
];

export function Ops() {
  const { toast } = useToast();
  const [ops, setOps] = useState<OrdemProducao[]>([]);
  const [filtered, setFiltered] = useState<OrdemProducao[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OPPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [opsData, clientesData] = await Promise.all([
        opsService.list(),
        clientesService.list(),
      ]);
      setOps(opsData);
      setFiltered(opsData);
      setClientes(clientesData);
    } catch {
      toast('error', 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      ops.filter((op) => {
        const matchSearch =
          op.codigo.toLowerCase().includes(q) ||
          (op.cliente?.nome ?? '').toLowerCase().includes(q);
        const matchStatus = filterStatus ? op.status === filterStatus : true;
        return matchSearch && matchStatus;
      }),
    );
  }, [search, filterStatus, ops]);

  const getClienteNome = (clienteId: string) =>
    clientes.find((c) => c.id === clienteId)?.nome ?? clienteId;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (op: OrdemProducao) => {
    setEditingId(op.id);
    setForm({
      codigo: op.codigo,
      cliente_id: op.cliente_id,
      status: op.status,
      observacoes: op.observacoes ?? '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim() || !form.cliente_id || submitting) return;
    setSubmitting(true);
    try {
      const payload: OPPayload = {
        codigo: form.codigo.trim(),
        cliente_id: form.cliente_id,
        status: form.status,
        observacoes: form.observacoes?.trim() || undefined,
      };
      if (editingId) {
        const updated = await opsService.update(editingId, payload);
        setOps((prev) => prev.map((op) => (op.id === editingId ? updated : op)));
        toast('success', 'OP atualizada com sucesso!');
      } else {
        const created = await opsService.create(payload);
        setOps((prev) => [...prev, created]);
        toast('success', 'OP criada com sucesso!');
      }
      closeModal();
    } catch {
      toast('error', 'Erro ao salvar OP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await opsService.remove(id);
      setOps((prev) => prev.filter((op) => op.id !== id));
      toast('success', 'OP removida com sucesso!');
    } catch {
      toast('error', 'Erro ao remover OP');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Ordens de Produção</h1>
          <p className="text-[14px] text-gray-400 mt-0.5">{ops.length} registradas</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#1a2340] text-white px-3.5 py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors"
        >
          <Plus size={14} />
          Nova OP
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Buscar por código ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200/60 rounded-md text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white border border-gray-200/60 rounded-md px-3 py-2 text-[15px] text-gray-600 focus:outline-none focus:border-gray-300 transition-colors"
        >
          <option value="">Todos os status</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200/60 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-[15px] text-gray-400">
              {search || filterStatus ? 'Nenhuma OP encontrada' : 'Nenhuma OP cadastrada'}
            </p>
            {!search && !filterStatus && (
              <button onClick={openCreate} className="text-[15px] text-blue-600 hover:underline">
                Criar primeira OP
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Código</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Peças</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Progresso</th>
                  <th className="px-4 py-2.5 w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((op, i) => (
                  <>
                    <tr
                      key={op.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        i < filtered.length - 1 && expandedId !== op.id ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-[15px] font-medium text-gray-900">{op.codigo}</td>
                      <td className="px-4 py-2.5 text-[15px] text-gray-500">{op.cliente?.nome ?? getClienteNome(op.cliente_id)}</td>
                      <td className="px-4 py-2.5"><Badge status={op.status} /></td>
                      <td className="px-4 py-2.5 text-[15px] text-gray-500 tabular-nums hidden sm:table-cell">
                        {op.pecas_concluidas}/{op.total_pecas}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1 min-w-[60px]">
                            <div
                              className="bg-[#1a2340] h-1 rounded-full transition-all"
                              style={{ width: `${op.percentual_conclusao}%` }}
                            />
                          </div>
                          <span className="text-[13px] text-gray-400 tabular-nums w-8 text-right">
                            {op.percentual_conclusao}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => toggleExpand(op.id)}
                            className="p-1.5 text-gray-300 hover:text-gray-600 rounded transition-colors"
                            title="Ver peças"
                          >
                            {expandedId === op.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button
                            onClick={() => openEdit(op)}
                            className="p-1.5 text-gray-300 hover:text-gray-600 rounded transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(op.id)}
                            disabled={deletingId === op.id}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === op.id && (
                      <tr key={`${op.id}-pecas`}>
                        <td colSpan={6} className="bg-gray-50/50 px-4 py-3 border-b border-gray-50">
                          {!op.pecas || op.pecas.length === 0 ? (
                            <p className="text-[14px] text-gray-400">Nenhuma peça nesta OP</p>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-[13px] font-medium text-gray-400 uppercase tracking-wider">Peças desta OP</p>
                              {op.pecas.map((peca: Peca) => (
                                <div key={peca.id} className="flex items-center gap-3 text-[14px] text-gray-600">
                                  <span className="font-medium text-gray-700">{peca.codigo}</span>
                                  <span className="text-gray-300">—</span>
                                  <span>{peca.descricao}</span>
                                  <Badge status={peca.status} />
                                  <span className="text-gray-400 tabular-nums">Qtd: {peca.quantidade}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-[16px] font-semibold text-gray-900">
                {editingId ? 'Editar OP' : 'Nova Ordem de Produção'}
              </h2>
              <button onClick={closeModal} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">
                  Código <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Ex: OP-2026-001"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">
                  Cliente <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300 bg-white transition-colors"
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as OrdemProducao['status'] })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300 bg-white transition-colors"
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações sobre a OP..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 resize-none transition-colors"
                />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#1a2340] text-white py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : editingId ? 'Salvar' : 'Criar OP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
