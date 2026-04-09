import api from './api';
import { Fornecedor } from '../types';

export interface FornecedorPayload {
  nome: string;
  contato?: string;
  email?: string;
  cnpj_cpf?: string;
}

export const fornecedoresService = {
  async list(): Promise<Fornecedor[]> {
    const { data } = await api.get<Fornecedor[]>('/fornecedores/');
    return data;
  },

  async get(id: string): Promise<Fornecedor> {
    const { data } = await api.get<Fornecedor>(`/fornecedores/${id}`);
    return data;
  },

  async create(payload: FornecedorPayload): Promise<Fornecedor> {
    const { data } = await api.post<Fornecedor>('/fornecedores/', payload);
    return data;
  },

  async update(id: string, payload: Partial<FornecedorPayload>): Promise<Fornecedor> {
    const { data } = await api.put<Fornecedor>(`/fornecedores/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/fornecedores/${id}`);
  },
};
