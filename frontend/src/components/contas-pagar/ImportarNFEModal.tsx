import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { nfeService } from '../../services/nfe';
import {
  ImportNFePayload,
  NFeApiError,
  PreviewNFeResponse,
} from '../../types/nfe';

type Stage = 'idle' | 'uploading' | 'reviewing' | 'saving' | 'error';

interface ImportarNFEModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParcelaForm {
  numero: string;
  vencimento: string;
  valor: string;
}

const categorias = [
  'material', 'servicos', 'fixas', 'impostos', 'carro', 'gasolina',
  'salario', 'aluguel', 'patrimonio', 'outros',
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ImportarNFEModal({ isOpen, onClose, onImported }: ImportarNFEModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<PreviewNFeResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<NFeApiError | null>(null);

  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('material');
  const [observacoes, setObservacoes] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([]);

  const reset = () => {
    setStage('idle');
    setPreview(null);
    setErrorInfo(null);
    setDescricao('');
    setCategoria('material');
    setObservacoes('');
    setDataEmissao('');
    setParcelas([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setStage('uploading');
    setErrorInfo(null);
    try {
      const data = await nfeService.preview(file);
      setPreview(data);
      setDescricao(data.sugestoes.descricao);
      setCategoria(data.sugestoes.categoria);
      setObservacoes(data.sugestoes.observacoes);
      setDataEmissao(data.parsed.data_emissao);
      const parcs = data.parsed.parcelas.length > 0
        ? data.parsed.parcelas.map((p) => ({
            numero: p.numero,
            vencimento: p.vencimento,
            valor: p.valor,
          }))
        : [{
            numero: '001',
            vencimento: data.parsed.data_emissao,
            valor: data.parsed.valor_total,
          }];
      setParcelas(parcs);
      setStage('reviewing');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: NFeApiError } } })
        ?.response?.data?.detail;
      if (detail) {
        setErrorInfo(detail);
        if (detail.code !== 'DUPLICATE') {
          toast('error', detail.message || 'Erro ao processar XML');
        }
      } else {
        toast('error', 'Erro ao enviar XML');
      }
      setStage('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || stage === 'saving') return;
    setStage('saving');
    try {
      const payload: ImportNFePayload = {
        chave_acesso: preview.parsed.chave_acesso,
        fornecedor: preview.fornecedor
          ? {
              id: preview.fornecedor.id,
              nome: preview.fornecedor.nome,
              cnpj: preview.parsed.emitente_cnpj,
              email: preview.parsed.emitente_email,
            }
          : {
              id: null,
              nome: preview.parsed.emitente_fantasia || preview.parsed.emitente_nome,
              cnpj: preview.parsed.emitente_cnpj,
              email: preview.parsed.emitente_email,
            },
        descricao,
        categoria,
        observacoes,
        data_emissao: dataEmissao,
        parcelas: parcelas.map((p) => ({
          vencimento: p.vencimento,
          valor: p.valor,
        })),
      };
      await nfeService.import(payload);
      toast('success', `${parcelas.length} ${parcelas.length === 1 ? 'conta criada' : 'contas criadas'}!`);
      reset();
      onImported();
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: NFeApiError } } })
        ?.response?.data?.detail;
      if (detail?.code === 'DUPLICATE') {
        setErrorInfo(detail);
        setStage('error');
      } else {
        toast('error', detail?.message || 'Erro ao importar NF-e');
        setStage('reviewing');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <h2 className="text-[16px] font-semibold text-gray-900">Importar NF-e por XML</h2>
          <button onClick={handleClose} className="text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {stage === 'idle' && (
            <div className="p-5 space-y-3">
              <p className="text-[14px] text-gray-600">
                Selecione o XML da NF-e recebida do fornecedor.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="block w-full text-[15px] text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#1a2340] file:text-white file:font-medium hover:file:bg-[#243052] file:cursor-pointer"
              />
            </div>
          )}

          {stage === 'uploading' && (
            <div className="p-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <p className="text-[14px] text-gray-500">Processando XML...</p>
            </div>
          )}

          {stage === 'error' && errorInfo && (
            <div className="p-5 space-y-3">
              {errorInfo.code === 'DUPLICATE' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
                  <p className="text-[14px] font-semibold text-amber-800">NF-e já importada</p>
                  <p className="text-[13px] text-amber-700 mt-1">
                    Esta NF-e foi importada em {errorInfo.importada_em
                      ? new Date(errorInfo.importada_em + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'}.
                    {errorInfo.contas_pagar_ids && errorInfo.contas_pagar_ids.length > 0 && (
                      <> Já existem {errorInfo.contas_pagar_ids.length} conta(s) a pagar vinculada(s).</>
                    )}
                  </p>
                </div>
              ) : errorInfo.code === 'WRONG_DIRECTION' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
                  <p className="text-[14px] font-semibold text-amber-800">XML não corresponde a esta tela</p>
                  <p className="text-[13px] text-amber-700 mt-1">{errorInfo.message}</p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
                  <p className="text-[14px] font-semibold text-red-800">{errorInfo.code}</p>
                  <p className="text-[13px] text-red-700 mt-1">{errorInfo.message || 'Erro ao processar XML'}</p>
                </div>
              )}
              <button onClick={reset} className="text-[14px] text-blue-600 hover:underline">
                Tentar com outro XML
              </button>
            </div>
          )}

          {(stage === 'reviewing' || stage === 'saving') && preview && (
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              {!preview.fornecedor && (
                <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
                  <p className="text-[13px] text-blue-700 font-medium">
                    Novo fornecedor será cadastrado: {preview.parsed.emitente_fantasia || preview.parsed.emitente_nome} (CNPJ {preview.parsed.emitente_cnpj})
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Descrição <span className="text-red-400">*</span></label>
                <input
                  type="text" required value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Categoria <span className="text-red-400">*</span></label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300">
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-500 mb-1">Data emissão</label>
                  <input
                    type="date" value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[14px] font-medium text-gray-600">Parcelas</p>
                  <p className="text-[13px] text-gray-500">
                    Total: {formatCurrency(parcelas.reduce((s, p) => s + Number(p.valor || 0), 0))}
                  </p>
                </div>
                <div className="space-y-2">
                  {parcelas.map((p, i) => (
                    <div key={i} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                      <span className="text-[13px] text-gray-500 font-medium">#{p.numero}</span>
                      <input
                        type="date" required value={p.vencimento}
                        onChange={(e) => {
                          const n = [...parcelas];
                          n[i] = { ...n[i], vencimento: e.target.value };
                          setParcelas(n);
                        }}
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[14px] text-gray-700 focus:outline-none focus:border-gray-300"
                      />
                      <input
                        type="number" step="0.01" min="0" required value={p.valor}
                        onChange={(e) => {
                          const n = [...parcelas];
                          n[i] = { ...n[i], valor: e.target.value };
                          setParcelas(n);
                        }}
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[14px] text-gray-700 focus:outline-none focus:border-gray-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-gray-500 mb-1">Observações</label>
                <textarea
                  rows={4} value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-[14px] text-gray-700 focus:outline-none focus:border-gray-300 resize-none font-mono"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={handleClose}
                  className="flex-1 border border-gray-200 text-gray-500 py-2 rounded-md text-[15px] font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={stage === 'saving'}
                  className="flex-1 bg-[#1a2340] text-white py-2 rounded-md text-[15px] font-medium hover:bg-[#243052] disabled:opacity-50">
                  {stage === 'saving' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
