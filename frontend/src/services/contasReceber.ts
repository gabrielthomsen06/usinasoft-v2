import api from './api';
import { ContaReceber } from '../types';

export interface ContaReceberPayload {
  descricao: string;
  cliente_id: string;
  ordem_producao_id?: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  total_parcelas?: number;
  intervalo_dias?: number;
  observacoes?: string;
}

export interface ContaReceberFilters {
  status?: string;
  cliente_id?: string;
  data_inicio?: string;
  data_fim?: string;
}

export const contasReceberService = {
  async list(filters?: ContaReceberFilters): Promise<ContaReceber[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.cliente_id) params.append('cliente_id', filters.cliente_id);
    if (filters?.data_inicio) params.append('data_inicio', filters.data_inicio);
    if (filters?.data_fim) params.append('data_fim', filters.data_fim);
    const { data } = await api.get<ContaReceber[]>(`/contas-receber/?${params}`);
    return data;
  },

  async get(id: string): Promise<ContaReceber> {
    const { data } = await api.get<ContaReceber>(`/contas-receber/${id}`);
    return data;
  },

  async create(payload: ContaReceberPayload): Promise<ContaReceber[]> {
    const { data } = await api.post<ContaReceber[]>('/contas-receber/', payload);
    return data;
  },

  async update(id: string, payload: Partial<ContaReceberPayload & { status: string; data_pagamento: string | null }>): Promise<ContaReceber> {
    const { data } = await api.put<ContaReceber>(`/contas-receber/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/contas-receber/${id}`);
  },
};
