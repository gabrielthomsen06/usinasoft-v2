import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { fornecedoresService, FornecedorPayload } from '../services/fornecedores';
import { Fornecedor } from '../types';

const emptyForm: FornecedorPayload = { nome: '', contato: '', email: '', cnpj_cpf: '' };

export function Fornecedores() {
  const { toast } = useToast();
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [filtered, setFiltered] = useState<Fornecedor[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FornecedorPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await fornecedoresService.list();
      setItems(data);
      setFiltered(data);
    } catch {
      toast('error', 'Erro ao carregar fornecedores');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(items.filter((f) =>
      f.nome.toLowerCase().includes(q) || (f.email ?? '').toLowerCase().includes(q) || (f.cnpj_cpf ?? '').includes(q)
    ));
  }, [search, items]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (f: Fornecedor) => {
    setEditingId(f.id);
    setForm({ nome: f.nome, contato: f.contato ?? '', email: f.email ?? '', cnpj_cpf: f.cnpj_cpf ?? '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setForm(emptyForm); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || submitting) return;
    setSubmitting(true);
    try {
      const payload: FornecedorPayload = {
        nome: form.nome.trim(),
        contato: form.contato?.trim() || undefined,
        email: form.email?.trim() || undefined,
        cnpj_cpf: form.cnpj_cpf?.trim() || undefined,
      };
      if (editingId) {
        const updated = await fornecedoresService.update(editingId, payload);
        setItems((prev) => prev.map((f) => (f.id === editingId ? updated : f)));
        toast('success', 'Fornecedor atualizado!');
      } else {
        const created = await fornecedoresService.create(payload);
        setItems((prev) => [...prev, created]);
        toast('success', 'Fornecedor cadastrado!');
      }
      closeModal();
    } catch {
      toast('error', 'Erro ao salvar fornecedor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await fornecedoresService.remove(id);
      setItems((prev) => prev.filter((f) => f.id !== id));
      toast('success', 'Fornecedor removido!');
    } catch {
      toast('error', 'Erro ao remover fornecedor');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Fornecedores</h1>
          <p className="text-[14px] text-gray-400 mt-0.5">{items.length} cadastrados</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-[#1a2340] text-white px-3.5 py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] transition-colors">
          <Plus size={14} /> Novo Fornecedor
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input type="text" placeholder="Buscar por nome, e-mail ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200/60 rounded-md text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
      </div>

      <div className="bg-white border border-gray-200/60 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-[15px] text-gray-400">{search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}</p>
            {!search && <button onClick={openCreate} className="text-[15px] text-blue-600 hover:underline">Cadastrar primeiro fornecedor</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Nome</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">Contato</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider">E-mail</th>
                  <th className="px-4 py-2.5 text-left text-[13px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">CNPJ/CPF</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={f.id} className={`hover:bg-gray-50/50 transition-colors ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <td className="px-4 py-2.5 text-[15px] font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-2.5 text-[15px] text-gray-500">{f.contato || '—'}</td>
                    <td className="px-4 py-2.5 text-[15px] text-gray-500">{f.email || '—'}</td>
                    <td className="px-4 py-2.5 text-[15px] text-gray-500 hidden lg:table-cell">{f.cnpj_cpf || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => openEdit(f)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded transition-colors" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(f.id)} disabled={deletingId === f.id} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors disabled:opacity-50" title="Excluir"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-[16px] font-semibold text-gray-900">{editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
              <button onClick={closeModal} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Nome <span className="text-red-400">*</span></label>
                <input type="text" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do fornecedor"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Contato</label>
                <input type="text" value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="Telefone"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@fornecedor.com"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">CNPJ/CPF</label>
                <input type="text" value={form.cnpj_cpf} onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })} placeholder="00.000.000/0001-00"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
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
