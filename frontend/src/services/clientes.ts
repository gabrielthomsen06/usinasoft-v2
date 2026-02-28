import api from './api';
import { Cliente } from '../types';

export interface ClientePayload {
  nome: string;
  contato?: string;
  email?: string;
  endereco?: string;
}

export const clientesService = {
  async list(): Promise<Cliente[]> {
    const { data } = await api.get<Cliente[]>('/clientes/');
    return data;
  },

  async get(id: string): Promise<Cliente> {
    const { data } = await api.get<Cliente>(`/clientes/${id}`);
    return data;
  },

  async create(payload: ClientePayload): Promise<Cliente> {
    const { data } = await api.post<Cliente>('/clientes/', payload);
    return data;
  },

  async update(id: string, payload: Partial<ClientePayload>): Promise<Cliente> {
    const { data } = await api.put<Cliente>(`/clientes/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/clientes/${id}`);
  },
};
