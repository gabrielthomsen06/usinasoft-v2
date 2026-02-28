import api from './api';
import { Peca } from '../types';

export interface PecaPayload {
  ordem_producao_id: string;
  cliente_id: string;
  codigo: string;
  descricao: string;
  pedido?: string;
  quantidade: number;
  data_entrega: string;
  status?: Peca['status'];
}

export const pecasService = {
  async list(params?: { status?: string; cliente_id?: string }): Promise<Peca[]> {
    const { data } = await api.get<Peca[]>('/pecas/', { params });
    return data;
  },

  async get(id: string): Promise<Peca> {
    const { data } = await api.get<Peca>(`/pecas/${id}`);
    return data;
  },

  async create(payload: PecaPayload): Promise<Peca> {
    const { data } = await api.post<Peca>('/pecas/', payload);
    return data;
  },

  async update(id: string, payload: Partial<PecaPayload>): Promise<Peca> {
    const { data } = await api.put<Peca>(`/pecas/${id}`, payload);
    return data;
  },

  async updateStatus(id: string, status: Peca['status']): Promise<Peca> {
    const { data } = await api.patch<Peca>(`/pecas/${id}/status`, { status });
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/pecas/${id}`);
  },
};
