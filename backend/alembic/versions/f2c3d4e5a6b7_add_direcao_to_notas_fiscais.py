"""add_direcao_to_notas_fiscais

Revision ID: f2c3d4e5a6b7
Revises: e8a1b2c3d4f5
Create Date: 2026-04-27 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f2c3d4e5a6b7'
down_revision: Union[str, None] = 'e8a1b2c3d4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'notas_fiscais',
        sa.Column(
            'direcao',
            sa.String(length=10),
            server_default='pagar',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('notas_fiscais', 'direcao')
