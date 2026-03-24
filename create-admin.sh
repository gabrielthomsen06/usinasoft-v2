#!/bin/bash
# ============================================
#  Criar usuário administrador
# ============================================

echo "=== Criar Usuário Admin ==="
echo ""

read -p "Email: " ADMIN_EMAIL
read -p "Primeiro nome: " ADMIN_FIRST
read -p "Último nome: " ADMIN_LAST
read -s -p "Senha: " ADMIN_PASS
echo ""

docker exec usinasoft_backend python -c "
import asyncio
from app.db.database import AsyncSessionLocal
from app.services.usuario_service import create_usuario
from app.schemas.usuario import UsuarioCreate

async def main():
    async with AsyncSessionLocal() as db:
        user = await create_usuario(db, UsuarioCreate(
            email='$ADMIN_EMAIL',
            password='$ADMIN_PASS',
            first_name='$ADMIN_FIRST',
            last_name='$ADMIN_LAST'
        ))
        await db.commit()
        print(f'Usuario criado com sucesso: {user.email}')

asyncio.run(main())
"

echo ""
echo "Pronto! Acesse o sistema e faça login."
