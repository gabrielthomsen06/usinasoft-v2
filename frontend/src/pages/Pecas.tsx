import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, RefreshCw, Search } from 'lucide-react';
import { Peca, Cliente, OrdemProducao } from '../types';
import { pecasService } from '../services/pecas';
import { clientesService } from '../services/clientes';
import { opsService } from '../services/ops';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

// ─── Zod schema ────────────────────────────────────────────────────────────
const pecaSchema = z.object({
  cliente_id: z.string().min(1, 'Cliente é obrigatório'),
  ordem_producao_id: z.string().min(1, 'Ordem de produção é obrigatória'),
  codigo: z.string().min(1, 'Código é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  pedido: z.string().optional(),
  quantidade: z.coerce.number().min(1, 'Quantidade mínima é 1'),
  data_entrega: z.string().min(1, 'Data de entrega é obrigatória'),
  status: z.enum(['em_fila', 'em_andamento', 'pausada', 'concluida', 'cancelada']).optional(),
});

type PecaFormValues = z.infer<typeof pecaSchema>;

const STATUS_OPTIONS: Peca['status'][] = [
  'em_fila',
  'em_andamento',
  'pausada',
  'concluida',
  'cancelada',
];

const STATUS_LABELS: Record<Peca['status'], string> = {
  em_fila: 'Em Fila',
  em_andamento: 'Em Andamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

// ─── Select helper ──────────────────────────────────────────────────────────
function SelectField({
  label,
  error,
  required,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-secondary">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={[
          'w-full px-3 py-2 border rounded-lg text-sm text-secondary bg-white',
          'focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-primary',
          'disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors',
          error ? 'border-red-400' : 'border-gray-300',
        ].join(' ')}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

// ─── Peca Form Modal ────────────────────────────────────────────────────────
function PecaFormModal({
  isOpen,
  onClose,
  peca,
  clientes,
  ops,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  peca: Peca | null;
  clientes: Cliente[];
  ops: OrdemProducao[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!peca;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PecaFormValues>({
    resolver: zodResolver(pecaSchema),
    defaultValues: {
      cliente_id: '',
      ordem_producao_id: '',
      codigo: '',
      descricao: '',
      pedido: '',
      quantidade: 1,
      data_entrega: '',
      status: 'em_fila',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (peca) {
        reset({
          cliente_id: peca.cliente_id,
          ordem_producao_id: peca.ordem_producao_id,
          codigo: peca.codigo,
          descricao: peca.descricao,
          pedido: peca.pedido ?? '',
          quantidade: peca.quantidade,
          data_entrega: peca.data_entrega?.slice(0, 10) ?? '',
          status: peca.status,
        });
      } else {
        reset({
          cliente_id: '',
          ordem_producao_id: '',
          codigo: '',
          descricao: '',
          pedido: '',
          quantidade: 1,
          data_entrega: '',
          status: 'em_fila',
        });
      }
    }
  }, [isOpen, peca, reset]);

  const onSubmit = async (values: PecaFormValues) => {
    try {
      if (isEditing && peca) {
        await pecasService.update(peca.id, values);
        toast('success', 'Peça atualizada com sucesso!');
      } else {
        await pecasService.create(values);
        toast('success', 'Peça cadastrada com sucesso!');
      }
      onSuccess();
      onClose();
    } catch {
      toast('error', `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} peça.`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Peça' : 'Cadastrar Peça'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller
            name="cliente_id"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Cliente"
                required
                error={errors.cliente_id?.message}
                {...field}
              >
                <option value="">Selecione o cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </SelectField>
            )}
          />

          <Controller
            name="ordem_producao_id"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Ordem de Produção (NF)"
                required
                error={errors.ordem_producao_id?.message}
                {...field}
              >
                <option value="">Selecione a OP</option>
                {ops.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.codigo}
                  </option>
                ))}
              </SelectField>
            )}
          />

          <Input
            label="Código da Peça"
            placeholder="Ex: PC-001"
            required
            error={errors.codigo?.message}
            {...register('codigo')}
          />

          <Input
            label="Número do Pedido (NF)"
            placeholder="Ex: NF-12345"
            error={errors.pedido?.message}
            {...register('pedido')}
          />
        </div>

        <Input
          label="Descrição"
          placeholder="Descrição da peça"
          required
          error={errors.descricao?.message}
          {...register('descricao')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Quantidade"
            type="number"
            min={1}
            required
            error={errors.quantidade?.message}
            {...register('quantidade')}
          />

          <Input
            label="Data de Entrega"
            type="date"
            required
            error={errors.data_entrega?.message}
            {...register('data_entrega')}
          />
        </div>

        {isEditing && (
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <SelectField
                label="Status"
                error={errors.status?.message}
                {...field}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </SelectField>
            )}
          />
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar Alterações' : 'Cadastrar Peça'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Status Change Modal ────────────────────────────────────────────────────
function StatusModal({
  isOpen,
  onClose,
  peca,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  peca: Peca | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<Peca['status']>('em_fila');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (peca) setSelectedStatus(peca.status);
  }, [peca]);

  const handleConfirm = async () => {
    if (!peca) return;
    setIsLoading(true);
    try {
      await pecasService.updateStatus(peca.id, selectedStatus);
      toast('success', 'Status atualizado com sucesso!');
      onSuccess();
      onClose();
    } catch {
      toast('error', 'Erro ao atualizar status.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alterar Status" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Peça: <span className="font-medium text-secondary">{peca?.codigo}</span>
        </p>
        <SelectField
          label="Novo Status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as Peca['status'])}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} loading={isLoading}>
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm Modal ───────────────────────────────────────────────────
function DeleteModal({
  isOpen,
  onClose,
  peca,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  peca: Peca | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!peca) return;
    setIsLoading(true);
    try {
      await pecasService.remove(peca.id);
      toast('success', 'Peça removida com sucesso!');
      onSuccess();
      onClose();
    } catch {
      toast('error', 'Erro ao remover peça.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar Exclusão" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir a peça{' '}
          <span className="font-semibold text-secondary">{peca?.codigo}</span>? Esta ação não pode
          ser desfeita.
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={isLoading}>
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export function Pecas() {
  const { toast } = useToast();
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ops, setOps] = useState<OrdemProducao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Peca['status'] | 'all'>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editPeca, setEditPeca] = useState<Peca | null>(null);
  const [statusPeca, setStatusPeca] = useState<Peca | null>(null);
  const [deletePeca, setDeletePeca] = useState<Peca | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, c, o] = await Promise.all([
        pecasService.list(),
        clientesService.list(),
        opsService.list(),
      ]);
      setPecas(p);
      setClientes(c);
      setOps(o);
    } catch {
      toast('error', 'Erro ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = pecas.filter((p) => {
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.codigo.toLowerCase().includes(q) ||
      p.descricao.toLowerCase().includes(q) ||
      (p.cliente?.nome ?? '').toLowerCase().includes(q) ||
      (p.pedido ?? '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const openCreate = () => {
    setEditPeca(null);
    setFormOpen(true);
  };

  const openEdit = (peca: Peca) => {
    setEditPeca(peca);
    setFormOpen(true);
  };

  const getClienteName = (peca: Peca) => {
    if (peca.cliente) return peca.cliente.nome;
    const c = clientes.find((c) => c.id === peca.cliente_id);
    return c?.nome ?? '—';
  };

  const getOpCodigo = (peca: Peca) => {
    if (peca.ordem_producao) return peca.ordem_producao.codigo;
    const op = ops.find((o) => o.id === peca.ordem_producao_id);
    return op?.codigo ?? '—';
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Peças</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pecas.length} {pecas.length === 1 ? 'peça cadastrada' : 'peças cadastradas'}
          </p>
        </div>
        <Button onClick={openCreate} size="md">
          <Plus size={16} />
          Cadastrar Peça
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código, descrição, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-primary"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium hidden sm:block">Status:</span>
          {(['all', ...STATUS_OPTIONS] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                filterStatus === s
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <button
          onClick={() => void loadData()}
          className="p-2 rounded-lg text-gray-500 hover:text-secondary hover:bg-gray-100 transition-colors"
          title="Atualizar"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <Search size={20} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">Nenhuma peça encontrada</p>
            {filterStatus !== 'all' || search ? (
              <button
                onClick={() => {
                  setSearch('');
                  setFilterStatus('all');
                }}
                className="text-xs text-primary hover:underline"
              >
                Limpar filtros
              </button>
            ) : (
              <Button size="sm" onClick={openCreate}>
                <Plus size={14} />
                Cadastrar primeira peça
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    OP / NF
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Qtd
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                    Entrega
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((peca) => (
                  <tr key={peca.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-secondary whitespace-nowrap">
                      {peca.codigo}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                      {peca.descricao}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell whitespace-nowrap">
                      {getClienteName(peca)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell whitespace-nowrap">
                      {getOpCodigo(peca)}
                      {peca.pedido && (
                        <span className="text-gray-400 text-xs ml-1">({peca.pedido})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden sm:table-cell">
                      {peca.quantidade}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden xl:table-cell whitespace-nowrap">
                      {peca.data_entrega
                        ? new Date(peca.data_entrega).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={peca.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setStatusPeca(peca)}
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                          title="Alterar status"
                        >
                          <RefreshCw size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(peca)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletePeca(peca)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <PecaFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        peca={editPeca}
        clientes={clientes}
        ops={ops}
        onSuccess={loadData}
      />
      <StatusModal
        isOpen={!!statusPeca}
        onClose={() => setStatusPeca(null)}
        peca={statusPeca}
        onSuccess={loadData}
      />
      <DeleteModal
        isOpen={!!deletePeca}
        onClose={() => setDeletePeca(null)}
        peca={deletePeca}
        onSuccess={loadData}
      />
    </div>
  );
}
