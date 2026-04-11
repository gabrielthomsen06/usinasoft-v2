"""Cria um usuário com role arbitrário (admin por padrão).

Uso dentro do container:
    python -m scripts.create_admin <email> <password> <first_name> <last_name> [role]
"""
import asyncio
import sys

from app.core.security import hash_password
from app.db.database import AsyncSessionLocal
from app.models.usuario import Usuario


async def main() -> None:
    if len(sys.argv) < 5:
        print("Uso: python -m scripts.create_admin <email> <password> <first_name> <last_name> [role]")
        sys.exit(1)

    email = sys.argv[1]
    password = sys.argv[2]
    first_name = sys.argv[3]
    last_name = sys.argv[4]
    role = sys.argv[5] if len(sys.argv) > 5 else "admin"

    async with AsyncSessionLocal() as db:
        user = Usuario(
            email=email,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            role=role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Criado: {user.email} | role={user.role}")


if __name__ == "__main__":
    asyncio.run(main())
