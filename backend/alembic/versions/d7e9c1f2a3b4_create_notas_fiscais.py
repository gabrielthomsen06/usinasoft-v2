"""create_notas_fiscais

Revision ID: d7e9c1f2a3b4
Revises: f1a2b3c4d5e6
Create Date: 2026-04-27 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'd7e9c1f2a3b4'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notas_fiscais',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('chave_acesso', sa.String(length=44), nullable=False),
        sa.Column('numero_nota', sa.String(length=20), nullable=False),
        sa.Column('serie', sa.String(length=10), nullable=True),
        sa.Column('modelo', sa.String(length=2), nullable=False),
        sa.Column('cnpj_emitente', sa.String(length=14), nullable=False),
        sa.Column('nome_emitente', sa.String(length=255), nullable=False),
        sa.Column('valor_total', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('data_emissao', sa.Date(), nullable=False),
        sa.Column('grupo_parcelas_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by_user_id', UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['usuarios.id']),
        sa.UniqueConstraint('chave_acesso', name='uq_notas_fiscais_chave_acesso'),
    )
    op.create_index('ix_notas_fiscais_chave_acesso', 'notas_fiscais', ['chave_acesso'])
    op.create_index('ix_notas_fiscais_cnpj_emitente', 'notas_fiscais', ['cnpj_emitente'])


def downgrade() -> None:
    op.drop_index('ix_notas_fiscais_cnpj_emitente', table_name='notas_fiscais')
    op.drop_index('ix_notas_fiscais_chave_acesso', table_name='notas_fiscais')
    op.drop_table('notas_fiscais')
