import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { opsService, OPPayload } from '../services/ops';
import { clientesService } from '../services/clientes';
import { OrdemProducao, Cliente } from '../types';

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
    if (!form.codigo.trim() || !form.cliente_id) return;
    setSubmitting(true);
    try {
      const payload: OPPayload = {
        codigo: form.codigo.trim(),
        cliente_id: form.cliente_id,
        status: form.status,
        observacoes: form.observacoes?.trim() || undefined,
      };
      if (editingId) {
        await opsService.update(editingId, payload);
        toast('success', 'OP atualizada com sucesso!');
      } else {
        await opsService.create(payload);
        toast('success', 'OP criada com sucesso!');
      }
      closeModal();
      load();
    } catch {
      toast('error', 'Erro ao salvar OP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await opsService.remove(id);
      toast('success', 'OP removida com sucesso!');
      load();
    } catch {
      toast('error', 'Erro ao remover OP');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Ordens de Produção</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerenciamento de ordens de produção</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus size={16} />
          Nova OP
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        >
          <option value="">Todos os status</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center">
              <ClipboardList size={26} className="text-primary" />
            </div>
            <p className="text-gray-500 text-sm font-medium">
              {search || filterStatus ? 'Nenhuma OP encontrada' : 'Nenhuma OP cadastrada'}
            </p>
            {!search && !filterStatus && (
              <button onClick={openCreate} className="text-primary text-sm hover:underline">
                Criar primeira OP
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Peças</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Progresso</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((op) => (
                  <>
                    <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-secondary">{op.codigo}</td>
                      <td className="px-6 py-4 text-gray-500">{op.cliente?.nome ?? getClienteNome(op.cliente_id)}</td>
                      <td className="px-6 py-4"><Badge status={op.status} /></td>
                      <td className="px-6 py-4 text-gray-500">
                        {op.pecas_concluidas}/{op.total_pecas}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[80px]">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${op.percentual_conclusao}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">
                            {op.percentual_conclusao}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleExpand(op.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver peças"
                          >
                            {expandedId === op.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                          <button
                            onClick={() => openEdit(op)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(op.id)}
                            disabled={deletingId === op.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expandable peças row */}
                    {expandedId === op.id && (
                      <tr key={`${op.id}-pecas`} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-3">
                          {op.pecas.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Nenhuma peça nesta OP</p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-gray-500 mb-2">Peças desta OP:</p>
                              {op.pecas.map((peca) => (
                                <div key={peca.id} className="flex items-center gap-3 text-xs text-gray-600">
                                  <span className="font-medium">{peca.codigo}</span>
                                  <span>—</span>
                                  <span>{peca.descricao}</span>
                                  <Badge status={peca.status} />
                                  <span className="text-gray-400">Qtd: {peca.quantidade}</span>
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
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-secondary">
                {editingId ? 'Editar OP' : 'Nova Ordem de Produção'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Ex: OP-2026-001"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as OrdemProducao['status'] })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações sobre a OP..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-60"
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