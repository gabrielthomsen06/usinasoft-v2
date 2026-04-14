"""add_parcelas_to_contas_receber

Revision ID: a1b2c3d4e5f6
Revises: 8c6584332576
Create Date: 2026-04-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8c6584332576'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contas_receber', sa.Column('parcela_atual', sa.Integer(), server_default='1', nullable=False))
    op.add_column('contas_receber', sa.Column('total_parcelas', sa.Integer(), server_default='1', nullable=False))


def downgrade() -> None:
    op.drop_column('contas_receber', 'total_parcelas')
    op.drop_column('contas_receber', 'parcela_atual')
