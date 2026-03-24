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
        <label className="text-[12px] font-medium text-gray-500">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <select
        className={[
          'w-full px-3 py-2 border rounded-md text-[13px] text-gray-700 bg-white',
          'focus:outline-none focus:border-gray-300 transition-colors',
          error ? 'border-red-300' : 'border-gray-200',
        ].join(' ')}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

        <div className="flex justify-end gap-2.5 pt-2">
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
      <div className="space-y-3.5">
        <p className="text-[13px] text-gray-500">
          Peça: <span className="font-medium text-gray-900">{peca?.codigo}</span>
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
        <div className="flex justify-end gap-2.5 pt-1">
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
      <div className="space-y-3.5">
        <p className="text-[13px] text-gray-600">
          Tem certeza que deseja excluir a peça{' '}
          <span className="font-medium text-gray-900">{peca?.codigo}</span>? Esta ação não pode
          ser desfeita.
        </p>
        <div className="flex justify-end gap-2.5 pt-1">
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
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Peças</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {pecas.length} {pecas.length === 1 ? 'cadastrada' : 'cadastradas'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#1a2340] text-white px-3.5 py-2 rounded-md text-[13px] font-medium hover:bg-[#243052] transition-colors self-start sm:self-auto"
        >
          <Plus size={14} />
          Cadastrar Peça
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Buscar por código, descrição, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200/60 rounded-md text-[13px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', ...STATUS_OPTIONS] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={[
                'px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                filterStatus === s
                  ? 'bg-[#1a2340] text-white'
                  : 'bg-white border border-gray-200/60 text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <button
          onClick={() => void loadData()}
          className="p-2 text-gray-300 hover:text-gray-600 transition-colors self-start"
          title="Atualizar"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200/60 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-[13px] text-gray-400">Nenhuma peça encontrada</p>
            {filterStatus !== 'all' || search ? (
              <button
                onClick={() => {
                  setSearch('');
                  setFilterStatus('all');
                }}
                className="text-[12px] text-blue-600 hover:underline"
              >
                Limpar filtros
              </button>
            ) : (
              <button onClick={openCreate} className="text-[12px] text-blue-600 hover:underline">
                Cadastrar primeira peça
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Cliente
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    OP / NF
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                    Qtd
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">
                    Entrega
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2.5 w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((peca, i) => (
                  <tr
                    key={peca.id}
                    className={`hover:bg-gray-50/50 transition-colors ${
                      i < filtered.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-[13px] font-medium text-gray-900 whitespace-nowrap">
                      {peca.codigo}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-gray-500 max-w-[180px] truncate">
                      {peca.descricao}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-gray-500 hidden md:table-cell whitespace-nowrap">
                      {getClienteName(peca)}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-gray-500 hidden lg:table-cell whitespace-nowrap">
                      {getOpCodigo(peca)}
                      {peca.pedido && (
                        <span className="text-gray-300 text-[11px] ml-1">({peca.pedido})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-[13px] text-gray-500 tabular-nums hidden sm:table-cell">
                      {peca.quantidade}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-gray-500 hidden xl:table-cell whitespace-nowrap">
                      {peca.data_entrega
                        ? new Date(peca.data_entrega).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge status={peca.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => setStatusPeca(peca)}
                          className="p-1.5 text-gray-300 hover:text-blue-500 rounded transition-colors"
                          title="Alterar status"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(peca)}
                          className="p-1.5 text-gray-300 hover:text-gray-600 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeletePeca(peca)}
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
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
