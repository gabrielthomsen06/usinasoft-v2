from datetime import date, timedelta
from typing import Optional

from sqlalchemy import and_, func, extract, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.conta_receber import ContaReceber
from app.models.conta_pagar import ContaPagar
from app.models.lancamento import Lancamento


async def get_dashboard_data(
    db: AsyncSession,
    mes: Optional[int] = None,
    ano: Optional[int] = None,
) -> dict:
    today = date.today()

    # Se mês/ano informados, filtra por esse período; senão usa mês atual
    if mes and ano:
        first_day = date(ano, mes, 1)
        if mes == 12:
            last_day = date(ano + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(ano, mes + 1, 1) - timedelta(days=1)
    else:
        first_day = today.replace(day=1)
        last_day = today
        mes = today.month
        ano = today.year

    # Total a receber (pendente + vencido) — geral, não filtrado por mês
    q = select(func.coalesce(func.sum(ContaReceber.valor), 0)).where(
        ContaReceber.status.in_(["pendente", "vencido"])
    )
    total_a_receber = float((await db.execute(q)).scalar())

    # Total a pagar (pendente + vencido) — geral
    q = select(func.coalesce(func.sum(ContaPagar.valor), 0)).where(
        ContaPagar.status.in_(["pendente", "vencido"])
    )
    total_a_pagar = float((await db.execute(q)).scalar())

    # Recebido no mês selecionado
    q = select(func.coalesce(func.sum(Lancamento.valor), 0)).where(
        and_(
            Lancamento.tipo == "receita",
            Lancamento.data >= first_day,
            Lancamento.data <= last_day,
        )
    )
    total_recebido_mes = float((await db.execute(q)).scalar())

    # Pago no mês selecionado
    q = select(func.coalesce(func.sum(Lancamento.valor), 0)).where(
        and_(
            Lancamento.tipo == "despesa",
            Lancamento.data >= first_day,
            Lancamento.data <= last_day,
        )
    )
    total_pago_mes = float((await db.execute(q)).scalar())

    # Contas vencidas (receber)
    q = select(func.count(), func.coalesce(func.sum(ContaReceber.valor), 0)).where(
        and_(ContaReceber.status == "pendente", ContaReceber.data_vencimento < today)
    )
    result = (await db.execute(q)).one()
    contas_vencidas_count = result[0]
    contas_vencidas_valor = float(result[1])

    # Receitas por mês (últimos 6 meses)
    six_months_ago = (today.replace(day=1) - timedelta(days=150)).replace(day=1)

    q = (
        select(
            extract("year", Lancamento.data).label("ano"),
            extract("month", Lancamento.data).label("mes"),
            func.sum(Lancamento.valor).label("total"),
        )
        .where(and_(Lancamento.tipo == "receita", Lancamento.data >= six_months_ago))
        .group_by("ano", "mes")
        .order_by("ano", "mes")
    )
    result = await db.execute(q)
    receitas_por_mes = [
        {"ano": int(r.ano), "mes": int(r.mes), "total": float(r.total)}
        for r in result.all()
    ]

    # Despesas por mês (últimos 6 meses)
    q = (
        select(
            extract("year", Lancamento.data).label("ano"),
            extract("month", Lancamento.data).label("mes"),
            func.sum(Lancamento.valor).label("total"),
        )
        .where(and_(Lancamento.tipo == "despesa", Lancamento.data >= six_months_ago))
        .group_by("ano", "mes")
        .order_by("ano", "mes")
    )
    result = await db.execute(q)
    despesas_por_mes = [
        {"ano": int(r.ano), "mes": int(r.mes), "total": float(r.total)}
        for r in result.all()
    ]

    # Gastos por categoria (contas a pagar do mês selecionado — pagas ou pendentes)
    q = (
        select(
            ContaPagar.categoria,
            func.sum(ContaPagar.valor).label("total"),
            func.count().label("quantidade"),
        )
        .where(
            and_(
                ContaPagar.data_vencimento >= first_day,
                ContaPagar.data_vencimento <= last_day,
            )
        )
        .group_by(ContaPagar.categoria)
        .order_by(func.sum(ContaPagar.valor).desc())
    )
    result = await db.execute(q)
    gastos_por_categoria = [
        {"categoria": r.categoria, "total": float(r.total), "quantidade": int(r.quantidade)}
        for r in result.all()
    ]

    # Últimas 10 transações
    q = select(Lancamento).order_by(Lancamento.data.desc(), Lancamento.created_at.desc()).limit(10)
    result = await db.execute(q)
    ultimas_transacoes = list(result.scalars().all())

    # Contas vencidas lista
    q = (
        select(ContaReceber)
        .where(and_(ContaReceber.status == "pendente", ContaReceber.data_vencimento < today))
        .order_by(ContaReceber.data_vencimento.asc())
        .limit(10)
    )
    result = await db.execute(q)
    contas_vencidas_list = list(result.scalars().all())

    return {
        "mes_selecionado": mes,
        "ano_selecionado": ano,
        "total_a_receber": total_a_receber,
        "total_a_pagar": total_a_pagar,
        "total_recebido_mes": total_recebido_mes,
        "total_pago_mes": total_pago_mes,
        "lucro_liquido": total_recebido_mes - total_pago_mes,
        "contas_vencidas_count": contas_vencidas_count,
        "contas_vencidas_valor": contas_vencidas_valor,
        "receitas_por_mes": receitas_por_mes,
        "despesas_por_mes": despesas_por_mes,
        "gastos_por_categoria": gastos_por_categoria,
        "ultimas_transacoes": ultimas_transacoes,
        "contas_vencidas_list": contas_vencidas_list,
    }


async def get_export_data(
    db: AsyncSession,
    mes: Optional[int] = None,
    ano: Optional[int] = None,
) -> dict:
    """Retorna dados para exportação Excel."""
    today = date.today()

    if mes and ano:
        first_day = date(ano, mes, 1)
        if mes == 12:
            last_day = date(ano + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(ano, mes + 1, 1) - timedelta(days=1)
    else:
        first_day = today.replace(day=1)
        last_day = today
        mes = today.month
        ano = today.year

    # Lançamentos do período
    q = (
        select(Lancamento)
        .where(and_(Lancamento.data >= first_day, Lancamento.data <= last_day))
        .order_by(Lancamento.data.asc())
    )
    result = await db.execute(q)
    lancamentos = list(result.scalars().all())

    # Contas a pagar do período
    q = (
        select(ContaPagar)
        .where(
            and_(
                ContaPagar.data_vencimento >= first_day,
                ContaPagar.data_vencimento <= last_day,
            )
        )
        .order_by(ContaPagar.data_vencimento.asc())
    )
    result = await db.execute(q)
    contas_pagar = list(result.scalars().all())

    # Contas a receber do período
    q = (
        select(ContaReceber)
        .where(
            and_(
                ContaReceber.data_vencimento >= first_day,
                ContaReceber.data_vencimento <= last_day,
            )
        )
        .order_by(ContaReceber.data_vencimento.asc())
    )
    result = await db.execute(q)
    contas_receber = list(result.scalars().all())

    return {
        "mes": mes,
        "ano": ano,
        "lancamentos": lancamentos,
        "contas_pagar": contas_pagar,
        "contas_receber": contas_receber,
    }
