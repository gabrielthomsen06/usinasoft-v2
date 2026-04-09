from typing import List

from pydantic import BaseModel

from app.schemas.lancamento import LancamentoResponse
from app.schemas.conta_receber import ContaReceberResponse


class GastoCategoria(BaseModel):
    categoria: str
    total: float
    quantidade: int


class DashboardFinanceiro(BaseModel):
    mes_selecionado: int
    ano_selecionado: int
    total_a_receber: float
    total_a_pagar: float
    total_recebido_mes: float
    total_pago_mes: float
    lucro_liquido: float
    contas_vencidas_count: int
    contas_vencidas_valor: float
    receitas_por_mes: List[dict]
    despesas_por_mes: List[dict]
    gastos_por_categoria: List[GastoCategoria]
    ultimas_transacoes: List[LancamentoResponse]
    contas_vencidas_list: List[ContaReceberResponse]
