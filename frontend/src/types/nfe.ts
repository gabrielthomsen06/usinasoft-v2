export interface NFeParcelaParsed {
  numero: string;
  vencimento: string;
  valor: string;
}

export interface NFeItemParsed {
  descricao: string;
  quantidade: string;
  valor_total: string;
}

export interface NFeParsedData {
  chave_acesso: string;
  numero_nota: string;
  serie: string;
  modelo: string;
  data_emissao: string;
  valor_total: string;
  emitente_cnpj: string;
  emitente_nome: string;
  emitente_fantasia?: string | null;
  emitente_email?: string | null;
  dest_cnpj_cpf?: string | null;
  dest_nome?: string | null;
  dest_email?: string | null;
  parcelas: NFeParcelaParsed[];
  itens: NFeItemParsed[];
}

export interface FornecedorVinculado {
  id: string;
  nome: string;
}

export interface PreviewSugestoes {
  descricao: string;
  categoria: string;
  observacoes: string;
}

export interface PreviewNFeResponse {
  parsed: NFeParsedData;
  fornecedor: FornecedorVinculado | null;
  sugestoes: PreviewSugestoes;
}

export interface ImportNFeFornecedor {
  id?: string | null;
  nome: string;
  cnpj: string;
  email?: string | null;
}

export interface ImportNFeParcela {
  vencimento: string;
  valor: string;
}

export interface ImportNFePayload {
  chave_acesso: string;
  fornecedor: ImportNFeFornecedor;
  descricao: string;
  categoria: string;
  observacoes?: string | null;
  data_emissao: string;
  parcelas: ImportNFeParcela[];
}

export interface ImportNFeResponse {
  contas_pagar_ids: string[];
  fornecedor_id: string;
  nota_fiscal_id: string;
}

export interface NFeApiError {
  code: string;
  message?: string;
  chave_acesso?: string;
  importada_em?: string;
  direcao?: string;
  contas_pagar_ids?: string[];
  contas_receber_ids?: string[];
  emitente_cnpj?: string;
  dest_cnpj_cpf?: string;
}

// ============= Receber =============

export interface ClienteVinculado {
  id: string;
  nome: string;
}

export interface PreviewSugestoesReceber {
  descricao: string;
  observacoes: string;
}

export interface PreviewNFeReceberResponse {
  parsed: NFeParsedData;
  cliente: ClienteVinculado | null;
  sugestoes: PreviewSugestoesReceber;
}

export interface ImportNFeCliente {
  id?: string | null;
  nome: string;
  cnpj_cpf: string;
  email?: string | null;
}

export interface ImportNFeReceberPayload {
  chave_acesso: string;
  cliente: ImportNFeCliente;
  descricao: string;
  observacoes?: string | null;
  data_emissao: string;
  parcelas: ImportNFeParcela[];
}

export interface ImportNFeReceberResponse {
  contas_receber_ids: string[];
  cliente_id: string;
  nota_fiscal_id: string;
}
