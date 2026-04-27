import api from './api';
import {
  ImportNFePayload,
  ImportNFeReceberPayload,
  ImportNFeReceberResponse,
  ImportNFeResponse,
  PreviewNFeReceberResponse,
  PreviewNFeResponse,
} from '../types/nfe';

export const nfeService = {
  async preview(file: File): Promise<PreviewNFeResponse> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<PreviewNFeResponse>(
      '/contas-pagar/preview-nfe',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async import(payload: ImportNFePayload): Promise<ImportNFeResponse> {
    const { data } = await api.post<ImportNFeResponse>(
      '/contas-pagar/import-nfe',
      payload,
    );
    return data;
  },

  async previewReceber(file: File): Promise<PreviewNFeReceberResponse> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<PreviewNFeReceberResponse>(
      '/contas-receber/preview-nfe',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async importReceber(payload: ImportNFeReceberPayload): Promise<ImportNFeReceberResponse> {
    const { data } = await api.post<ImportNFeReceberResponse>(
      '/contas-receber/import-nfe',
      payload,
    );
    return data;
  },
};
