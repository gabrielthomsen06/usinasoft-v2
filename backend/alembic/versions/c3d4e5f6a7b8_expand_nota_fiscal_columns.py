"""expand_nota_fiscal_columns

Aumenta chave_acesso (44→50) para acomodar chave nacional NFS-e
e modelo (2→10) para acomodar valores como "NFSE".

Operação non-destructive: ALTER COLUMN type para VARCHAR maior
no PostgreSQL é metadata only, dados existentes permanecem intactos.

Revision ID: c3d4e5f6a7b8
Revises: f2c3d4e5a6b7
Create Date: 2026-05-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'f2c3d4e5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'notas_fiscais', 'chave_acesso',
        type_=sa.String(length=50),
        existing_type=sa.String(length=44),
        existing_nullable=False,
    )
    op.alter_column(
        'notas_fiscais', 'modelo',
        type_=sa.String(length=10),
        existing_type=sa.String(length=2),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'notas_fiscais', 'modelo',
        type_=sa.String(length=2),
        existing_type=sa.String(length=10),
        existing_nullable=False,
    )
    op.alter_column(
        'notas_fiscais', 'chave_acesso',
        type_=sa.String(length=44),
        existing_type=sa.String(length=50),
        existing_nullable=False,
    )
