import api from './api';
import { Lancamento, ResumoFinanceiro } from '../types';

export interface LancamentoPayload {
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  data: string;
  conta_receber_id?: string;
  conta_pagar_id?: string;
  observacoes?: string;
}

export interface LancamentoFilters {
  tipo?: string;
  data_inicio?: string;
  data_fim?: string;
}

export const lancamentosService = {
  async list(filters?: LancamentoFilters): Promise<Lancamento[]> {
    const params = new URLSearchParams();
    if (filters?.tipo) params.append('tipo', filters.tipo);
    if (filters?.data_inicio) params.append('data_inicio', filters.data_inicio);
    if (filters?.data_fim) params.append('data_fim', filters.data_fim);
    const { data } = await api.get<Lancamento[]>(`/lancamentos/?${params}`);
    return data;
  },

  async resumo(filters?: { data_inicio?: string; data_fim?: string }): Promise<ResumoFinanceiro> {
    const params = new URLSearchParams();
    if (filters?.data_inicio) params.append('data_inicio', filters.data_inicio);
    if (filters?.data_fim) params.append('data_fim', filters.data_fim);
    const { data } = await api.get<ResumoFinanceiro>(`/lancamentos/resumo?${params}`);
    return data;
  },

  async create(payload: LancamentoPayload): Promise<Lancamento> {
    const { data } = await api.post<Lancamento>('/lancamentos/', payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/lancamentos/${id}`);
  },
};
