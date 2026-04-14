import api from './api';
import { ContaPagar } from '../types';

export interface ContaPagarPayload {
  descricao: string;
  fornecedor_id?: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  categoria: string;
  total_parcelas?: number;
  intervalo_dias?: number;
  observacoes?: string;
}

export interface ContaPagarFilters {
  status?: string;
  categoria?: string;
  data_inicio?: string;
  data_fim?: string;
}

export const contasPagarService = {
  async list(filters?: ContaPagarFilters): Promise<ContaPagar[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.categoria) params.append('categoria', filters.categoria);
    if (filters?.data_inicio) params.append('data_inicio', filters.data_inicio);
    if (filters?.data_fim) params.append('data_fim', filters.data_fim);
    const { data } = await api.get<ContaPagar[]>(`/contas-pagar/?${params}`);
    return data;
  },

  async get(id: string): Promise<ContaPagar> {
    const { data } = await api.get<ContaPagar>(`/contas-pagar/${id}`);
    return data;
  },

  async create(payload: ContaPagarPayload): Promise<ContaPagar[]> {
    const { data } = await api.post<ContaPagar[]>('/contas-pagar/', payload);
    return data;
  },

  async update(id: string, payload: Partial<ContaPagarPayload & { status: string; data_pagamento: string | null }>): Promise<ContaPagar> {
    const { data } = await api.put<ContaPagar>(`/contas-pagar/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/contas-pagar/${id}`);
  },
};
