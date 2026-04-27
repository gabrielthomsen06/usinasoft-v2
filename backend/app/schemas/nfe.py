import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class NFeParcelaParsed(BaseModel):
    numero: str
    vencimento: date
    valor: Decimal


class NFeItemParsed(BaseModel):
    descricao: str
    quantidade: Decimal
    valor_total: Decimal


class NFeParsedData(BaseModel):
    chave_acesso: str
    numero_nota: str
    serie: str
    modelo: str
    data_emissao: date
    valor_total: Decimal
    emitente_cnpj: str
    emitente_nome: str
    emitente_fantasia: Optional[str] = None
    emitente_email: Optional[str] = None
    dest_cnpj_cpf: Optional[str] = None
    dest_nome: Optional[str] = None
    dest_email: Optional[str] = None
    parcelas: List[NFeParcelaParsed] = Field(default_factory=list)
    itens: List[NFeItemParsed] = Field(default_factory=list)


# ============= Pagar =============

class FornecedorVinculado(BaseModel):
    id: uuid.UUID
    nome: str


class PreviewSugestoesPagar(BaseModel):
    descricao: str
    categoria: str
    observacoes: str


class PreviewNFePagarResponse(BaseModel):
    parsed: NFeParsedData
    fornecedor: Optional[FornecedorVinculado] = None
    sugestoes: PreviewSugestoesPagar


class FornecedorImportInput(BaseModel):
    id: Optional[uuid.UUID] = None
    nome: str
    cnpj: str
    email: Optional[str] = None


class ParcelaImportInput(BaseModel):
    vencimento: date
    valor: Decimal


class ImportNFePagarRequest(BaseModel):
    chave_acesso: str
    fornecedor: FornecedorImportInput
    descricao: str
    categoria: str
    observacoes: Optional[str] = None
    data_emissao: date
    parcelas: List[ParcelaImportInput]


class ImportNFePagarResponse(BaseModel):
    contas_pagar_ids: List[uuid.UUID]
    fornecedor_id: uuid.UUID
    nota_fiscal_id: uuid.UUID


# ============= Receber =============

class PreviewSugestoesReceber(BaseModel):
    descricao: str
    observacoes: str


class PreviewNFeReceberResponse(BaseModel):
    parsed: NFeParsedData
    cliente: Optional[FornecedorVinculado] = None
    sugestoes: PreviewSugestoesReceber


class ClienteImportInput(BaseModel):
    id: Optional[uuid.UUID] = None
    nome: str
    cnpj_cpf: str
    email: Optional[str] = None


class ImportNFeReceberRequest(BaseModel):
    chave_acesso: str
    cliente: ClienteImportInput
    descricao: str
    observacoes: Optional[str] = None
    data_emissao: date
    parcelas: List[ParcelaImportInput]


class ImportNFeReceberResponse(BaseModel):
    contas_receber_ids: List[uuid.UUID]
    cliente_id: uuid.UUID
    nota_fiscal_id: uuid.UUID


# ============= Aliases backward-compat (frontend Pagar atual) =============
# O modal Pagar do frontend ainda usa nomes antigos. Mantendo aliases:
ImportNFeRequest = ImportNFePagarRequest
ImportNFeResponse = ImportNFePagarResponse
PreviewNFeResponse = PreviewNFePagarResponse
PreviewSugestoes = PreviewSugestoesPagar
