import math
import uuid
from datetime import date, timedelta
from typing import List, Optional

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.conta_pagar import ContaPagar
from app.models.lancamento import Lancamento
from app.schemas.conta_pagar import ContaPagarCreate, ContaPagarUpdate
from datetime import date as date_type


async def get_conta_pagar_by_id(db: AsyncSession, conta_id: uuid.UUID) -> ContaPagar:
    result = await db.execute(select(ContaPagar).where(ContaPagar.id == conta_id))
    conta = result.scalar_one_or_none()
    if not conta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conta a pagar não encontrada"
        )
    return conta


async def list_contas_pagar(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    categoria: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
) -> List[ContaPagar]:
    query = select(ContaPagar)

    today = date_type.today()
    filters = []
    if status_filter:
        if status_filter == "vencido":
            # "vencido" é computado: pendente com vencimento no passado
            filters.append(ContaPagar.status == "pendente")
            filters.append(ContaPagar.data_vencimento < today)
        elif status_filter == "pendente":
            # "pendente" exclui os já vencidos para não duplicar na listagem
            filters.append(ContaPagar.status == "pendente")
            filters.append(ContaPagar.data_vencimento >= today)
        else:
            filters.append(ContaPagar.status == status_filter)
    if categoria:
        filters.append(ContaPagar.categoria == categoria)
    if data_inicio:
        filters.append(ContaPagar.data_vencimento >= data_inicio)
    if data_fim:
        filters.append(ContaPagar.data_vencimento <= data_fim)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(ContaPagar.data_vencimento.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_conta_pagar(db: AsyncSession, data: ContaPagarCreate) -> List[ContaPagar]:
    total_parcelas = max(data.total_parcelas, 1)
    intervalo_dias = data.intervalo_dias
    base_data = data.model_dump(exclude={"total_parcelas", "intervalo_dias"})
    valor_total = base_data["valor"]
    valor_parcela = round(valor_total / total_parcelas, 2)
    # Ajustar centavos na última parcela
    valor_ultima = round(valor_total - valor_parcela * (total_parcelas - 1), 2)

    grupo_id = uuid.uuid4() if total_parcelas > 1 else None

    contas: List[ContaPagar] = []
    for i in range(total_parcelas):
        if intervalo_dias is not None:
            vencimento = data.data_vencimento + timedelta(days=intervalo_dias * i)
        else:
            vencimento = data.data_vencimento + relativedelta(months=i)
        conta = ContaPagar(
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


async def update_conta_pagar(
    db: AsyncSession, conta_id: uuid.UUID, data: ContaPagarUpdate
) -> ContaPagar:
    conta = await get_conta_pagar_by_id(db, conta_id)

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
            select(Lancamento).where(Lancamento.conta_pagar_id == conta.id)
        )
        if not existing_lanc.scalar_one_or_none():
            lancamento = Lancamento(
                tipo="despesa",
                descricao=f"Pagamento: {conta.descricao}",
                valor=conta.valor,
                data=conta.data_pagamento,
                conta_pagar_id=conta.id,
            )
            db.add(lancamento)
    elif was_paid and new_status != "pago":
        result = await db.execute(
            select(Lancamento).where(Lancamento.conta_pagar_id == conta.id)
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
            select(ContaPagar).where(
                and_(
                    ContaPagar.grupo_parcelas_id == conta.grupo_parcelas_id,
                    ContaPagar.parcela_atual > 1,
                    ContaPagar.status != "pago",
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


async def delete_conta_pagar(db: AsyncSession, conta_id: uuid.UUID) -> None:
    conta = await get_conta_pagar_by_id(db, conta_id)
    # Deletar lançamentos vinculados primeiro (FK constraint)
    result = await db.execute(
        select(Lancamento).where(Lancamento.conta_pagar_id == conta_id)
    )
    for lanc in result.scalars().all():
        await db.delete(lanc)
    await db.delete(conta)
    await db.flush()
