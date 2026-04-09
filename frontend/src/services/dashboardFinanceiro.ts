import api from './api';
import { DashboardFinanceiro } from '../types';

export interface DashboardFilters {
  mes?: number;
  ano?: number;
}

export const dashboardFinanceiroService = {
  async getData(filters?: DashboardFilters): Promise<DashboardFinanceiro> {
    const params = new URLSearchParams();
    if (filters?.mes) params.append('mes', String(filters.mes));
    if (filters?.ano) params.append('ano', String(filters.ano));
    const { data } = await api.get<DashboardFinanceiro>(`/dashboard-financeiro/?${params}`);
    return data;
  },

  async exportar(filters?: DashboardFilters): Promise<void> {
    const params = new URLSearchParams();
    if (filters?.mes) params.append('mes', String(filters.mes));
    if (filters?.ano) params.append('ano', String(filters.ano));
    const response = await api.get(`/dashboard-financeiro/exportar?${params}`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const contentDisposition = response.headers['content-disposition'];
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
      : 'financeiro.xlsx';
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
