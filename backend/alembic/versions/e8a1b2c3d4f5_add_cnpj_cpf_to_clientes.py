"""add_cnpj_cpf_to_clientes

Revision ID: e8a1b2c3d4f5
Revises: d7e9c1f2a3b4
Create Date: 2026-04-27 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e8a1b2c3d4f5'
down_revision: Union[str, None] = 'd7e9c1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'clientes',
        sa.Column('cnpj_cpf', sa.String(length=20), nullable=True),
    )
    op.create_unique_constraint(
        'uq_clientes_cnpj_cpf', 'clientes', ['cnpj_cpf']
    )


def downgrade() -> None:
    op.drop_constraint('uq_clientes_cnpj_cpf', 'clientes', type_='unique')
    op.drop_column('clientes', 'cnpj_cpf')
