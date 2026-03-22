export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  contato?: string;
  email?: string;
  endereco?: string;
  created_at: string;
  updated_at: string;
}

export interface OrdemProducao {
  id: string;
  codigo: string;
  cliente_id: string;
  cliente?: Cliente;
  status: 'aberta' | 'em_andamento' | 'concluida';
  observacoes?: string;
  total_pecas: number;
  pecas_concluidas: number;
  percentual_conclusao: number;
  pecas?: Peca[];
  created_at: string;
  updated_at: string;
}

export interface Peca {
  id: string;
  ordem_producao_id: string;
  ordem_producao?: OrdemProducao;
  cliente_id: string;
  cliente?: Cliente;
  codigo: string;
  descricao: string;
  pedido?: string;
  quantidade: number;
  data_entrega: string;
  status: 'em_fila' | 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
