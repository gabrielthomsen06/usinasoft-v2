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


class FornecedorVinculado(BaseModel):
    id: uuid.UUID
    nome: str


class PreviewSugestoes(BaseModel):
    descricao: str
    categoria: str
    observacoes: str


class PreviewNFeResponse(BaseModel):
    parsed: NFeParsedData
    fornecedor: Optional[FornecedorVinculado] = None
    sugestoes: PreviewSugestoes


class FornecedorImportInput(BaseModel):
    id: Optional[uuid.UUID] = None
    nome: str
    cnpj: str
    email: Optional[str] = None


class ParcelaImportInput(BaseModel):
    vencimento: date
    valor: Decimal


class ImportNFeRequest(BaseModel):
    chave_acesso: str
    fornecedor: FornecedorImportInput
    descricao: str
    categoria: str
    observacoes: Optional[str] = None
    data_emissao: date
    parcelas: List[ParcelaImportInput]


class ImportNFeResponse(BaseModel):
    contas_pagar_ids: List[uuid.UUID]
    fornecedor_id: uuid.UUID
    nota_fiscal_id: uuid.UUID
