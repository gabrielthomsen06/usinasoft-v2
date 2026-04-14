import uuid
from datetime import date, date as date_type, timedelta
from typing import List, Optional

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.conta_receber import ContaReceber
from app.models.lancamento import Lancamento
from app.schemas.conta_receber import ContaReceberCreate, ContaReceberUpdate


async def get_conta_receber_by_id(db: AsyncSession, conta_id: uuid.UUID) -> ContaReceber:
    result = await db.execute(select(ContaReceber).where(ContaReceber.id == conta_id))
    conta = result.scalar_one_or_none()
    if not conta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conta a receber não encontrada"
        )
    return conta


async def list_contas_receber(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    cliente_id: Optional[uuid.UUID] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
) -> List[ContaReceber]:
    query = select(ContaReceber)

    today = date_type.today()
    filters = []
    if status_filter:
        if status_filter == "vencido":
            filters.append(ContaReceber.status == "pendente")
            filters.append(ContaReceber.data_vencimento < today)
        elif status_filter == "pendente":
            filters.append(ContaReceber.status == "pendente")
            filters.append(ContaReceber.data_vencimento >= today)
        else:
            filters.append(ContaReceber.status == status_filter)
    if cliente_id:
        filters.append(ContaReceber.cliente_id == cliente_id)
    if data_inicio:
        filters.append(ContaReceber.data_vencimento >= data_inicio)
    if data_fim:
        filters.append(ContaReceber.data_vencimento <= data_fim)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(ContaReceber.data_vencimento.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_conta_receber(db: AsyncSession, data: ContaReceberCreate) -> List[ContaReceber]:
    total_parcelas = max(data.total_parcelas, 1)
    intervalo_dias = data.intervalo_dias
    base_data = data.model_dump(exclude={"total_parcelas", "intervalo_dias"})
    valor_total = base_data["valor"]
    valor_parcela = round(valor_total / total_parcelas, 2)
    valor_ultima = round(valor_total - valor_parcela * (total_parcelas - 1), 2)

    grupo_id = uuid.uuid4() if total_parcelas > 1 else None

    contas: List[ContaReceber] = []
    for i in range(total_parcelas):
        if intervalo_dias is not None:
            vencimento = data.data_vencimento + timedelta(days=intervalo_dias * i)
        else:
            vencimento = data.data_vencimento + relativedelta(months=i)
        conta = ContaReceber(
            **{
                **base_data,
                "valor": valor_parcela if i < total_parcelas - 1 else valor_ultima,
                "data_vencimento": vencimento,
                "parcela_atual": i + 1,
                "total_parcelas": total_parcelas,
                "grupo_parcelas_id": grupo_id,
                "intervalo_dias": intervalo_dias,
            }
        )
        if total_parcelas > 1:
            conta.descricao = f"{base_data['descricao']} ({i + 1}/{total_parcelas})"
        db.add(conta)
        contas.append(conta)

    await db.flush()
    for c in contas:
        await db.refresh(c)
    return contas


async def update_conta_receber(
    db: AsyncSession, conta_id: uuid.UUID, data: ContaReceberUpdate
) -> ContaReceber:
    conta = await get_conta_receber_by_id(db, conta_id)

    update_data = data.model_dump(exclude_unset=True)
    recalcular = update_data.pop("recalcular_parcelas_futuras", False)

    was_paid = conta.status == "pago"
    new_status = update_data.get("status", conta.status)

    novo_vencimento = update_data.get("data_vencimento", conta.data_vencimento)
    novo_intervalo = update_data.get("intervalo_dias", conta.intervalo_dias)

    for field, value in update_data.items():
        setattr(conta, field, value)

    if not was_paid and new_status == "pago":
        if not conta.data_pagamento:
            conta.data_pagamento = date.today()
        existing_lanc = await db.execute(
            select(Lancamento).where(Lancamento.conta_receber_id == conta.id)
        )
        if not existing_lanc.scalar_one_or_none():
            lancamento = Lancamento(
                tipo="receita",
                descricao=f"Recebimento: {conta.descricao}",
                valor=conta.valor,
                data=conta.data_pagamento,
                conta_receber_id=conta.id,
            )
            db.add(lancamento)
    elif was_paid and new_status != "pago":
        result = await db.execute(
            select(Lancamento).where(Lancamento.conta_receber_id == conta.id)
        )
        for lanc in result.scalars().all():
            await db.delete(lanc)
        conta.data_pagamento = None

    if (
        recalcular
        and conta.parcela_atual == 1
        and conta.grupo_parcelas_id is not None
        and novo_intervalo is not None
    ):
        irmas_result = await db.execute(
            select(ContaReceber).where(
                and_(
                    ContaReceber.grupo_parcelas_id == conta.grupo_parcelas_id,
                    ContaReceber.parcela_atual > 1,
                    ContaReceber.status != "pago",
                )
            )
        )
        for irma in irmas_result.scalars().all():
            irma.data_vencimento = novo_vencimento + timedelta(
                days=novo_intervalo * (irma.parcela_atual - 1)
            )
            irma.intervalo_dias = novo_intervalo

    await db.flush()
    await db.refresh(conta)
    return conta


async def delete_conta_receber(db: AsyncSession, conta_id: uuid.UUID) -> None:
    conta = await get_conta_receber_by_id(db, conta_id)
    result = await db.execute(
        select(Lancamento).where(Lancamento.conta_receber_id == conta_id)
    )
    for lanc in result.scalars().all():
        await db.delete(lanc)
    await db.delete(conta)
    await db.flush()
