import api from './api';
import {
  ImportNFePayload,
  ImportNFeResponse,
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
};
