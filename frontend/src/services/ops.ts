import api from './api';
import { OrdemProducao } from '../types';

export interface OPPayload {
  codigo: string;
  cliente_id: string;
  status?: OrdemProducao['status'];
  observacoes?: string;
}

export const opsService = {
  async list(params?: { status?: string; cliente_id?: string }): Promise<OrdemProducao[]> {
    const { data } = await api.get<OrdemProducao[]>('/ops/', { params });
    return data;
  },

  async get(id: string): Promise<OrdemProducao> {
    const { data } = await api.get<OrdemProducao>(`/ops/${id}`);
    return data;
  },

  async create(payload: OPPayload): Promise<OrdemProducao> {
    const { data } = await api.post<OrdemProducao>('/ops/', payload);
    return data;
  },

  async update(id: string, payload: Partial<OPPayload>): Promise<OrdemProducao> {
    const { data } = await api.put<OrdemProducao>(`/ops/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/ops/${id}`);
  },
};
