"""add_grupo_parcelas_id

Revision ID: f1a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2026-04-14 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for tabela in ('contas_receber', 'contas_pagar'):
        op.add_column(
            tabela,
            sa.Column('grupo_parcelas_id', UUID(as_uuid=True), nullable=True),
        )
        op.create_index(
            f'ix_{tabela}_grupo_parcelas_id',
            tabela,
            ['grupo_parcelas_id'],
        )
        op.add_column(
            tabela,
            sa.Column('intervalo_dias', sa.Integer(), nullable=True),
        )

    # Backfill: agrupa parcelas existentes por chave natural
    op.execute("""
        WITH grupos AS (
            SELECT
                descricao,
                cliente_id,
                total_parcelas,
                data_emissao,
                gen_random_uuid() AS grupo_id
            FROM (
                SELECT DISTINCT
                    regexp_replace(descricao, ' \\([0-9]+/[0-9]+\\)$', '') AS descricao,
                    cliente_id,
                    total_parcelas,
                    data_emissao
                FROM contas_receber
                WHERE total_parcelas > 1
            ) d
        )
        UPDATE contas_receber c
        SET grupo_parcelas_id = g.grupo_id
        FROM grupos g
        WHERE regexp_replace(c.descricao, ' \\([0-9]+/[0-9]+\\)$', '') = g.descricao
          AND c.cliente_id = g.cliente_id
          AND c.total_parcelas = g.total_parcelas
          AND c.data_emissao = g.data_emissao
          AND c.total_parcelas > 1;
    """)

    op.execute("""
        WITH grupos AS (
            SELECT
                descricao,
                COALESCE(fornecedor_id::text, '00000000-0000-0000-0000-000000000000') AS fornecedor_key,
                total_parcelas,
                data_emissao,
                gen_random_uuid() AS grupo_id
            FROM (
                SELECT DISTINCT
                    regexp_replace(descricao, ' \\([0-9]+/[0-9]+\\)$', '') AS descricao,
                    fornecedor_id,
                    total_parcelas,
                    data_emissao
                FROM contas_pagar
                WHERE total_parcelas > 1
            ) d
        )
        UPDATE contas_pagar c
        SET grupo_parcelas_id = g.grupo_id
        FROM grupos g
        WHERE regexp_replace(c.descricao, ' \\([0-9]+/[0-9]+\\)$', '') = g.descricao
          AND COALESCE(c.fornecedor_id::text, '00000000-0000-0000-0000-000000000000') = g.fornecedor_key
          AND c.total_parcelas = g.total_parcelas
          AND c.data_emissao = g.data_emissao
          AND c.total_parcelas > 1;
    """)


def downgrade() -> None:
    for tabela in ('contas_receber', 'contas_pagar'):
        op.drop_column(tabela, 'intervalo_dias')
        op.drop_index(f'ix_{tabela}_grupo_parcelas_id', table_name=tabela)
        op.drop_column(tabela, 'grupo_parcelas_id')
