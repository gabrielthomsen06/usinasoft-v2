export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  contato?: string;
  email?: string;
  cnpj_cpf?: string;
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

export interface Fornecedor {
  id: string;
  nome: string;
  contato?: string;
  email?: string;
  cnpj_cpf?: string;
  created_at: string;
  updated_at: string;
}

export interface ContaReceber {
  id: string;
  descricao: string;
  cliente_id: string;
  cliente?: Cliente;
  ordem_producao_id?: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado';
  parcela_atual: number;
  total_parcelas: number;
  grupo_parcelas_id?: string;
  intervalo_dias?: number;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContaPagar {
  id: string;
  descricao: string;
  fornecedor_id?: string;
  fornecedor?: Fornecedor;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento?: string;
  categoria: string;
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado';
  parcela_atual: number;
  total_parcelas: number;
  grupo_parcelas_id?: string;
  intervalo_dias?: number;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface Lancamento {
  id: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  data: string;
  conta_receber_id?: string;
  conta_pagar_id?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ResumoFinanceiro {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
}

export interface GastoCategoria {
  categoria: string;
  total: number;
  quantidade: number;
}

export interface DashboardFinanceiro {
  mes_selecionado: number;
  ano_selecionado: number;
  total_a_receber: number;
  total_a_pagar: number;
  total_recebido_mes: number;
  total_pago_mes: number;
  lucro_liquido: number;
  contas_vencidas_count: number;
  contas_vencidas_valor: number;
  receitas_por_mes: { ano: number; mes: number; total: number }[];
  despesas_por_mes: { ano: number; mes: number; total: number }[];
  gastos_por_categoria: GastoCategoria[];
  ultimas_transacoes: Lancamento[];
  contas_vencidas_list: ContaReceber[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
