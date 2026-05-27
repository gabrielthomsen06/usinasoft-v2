"""Cria um usuário (admin por padrão) lendo a senha via stdin.

A senha NUNCA é passada por argv para não vazar em `ps`/listagens de
processo. Em modo interativo usa `getpass`; em modo não-interativo
(pipe) lê a primeira linha de stdin.

Uso dentro do container:
    # interativo (prompt seguro):
    python -m scripts.create_admin <email> <first_name> <last_name> [role]

    # via pipe (ex.: chamado pelo create-admin.sh):
    printf '%s\\n' "$SENHA" | python -m scripts.create_admin <email> <first_name> <last_name> [role]
"""
import asyncio
import getpass
import sys

from app.core.security import hash_password
from app.db.database import AsyncSessionLocal
from app.models.usuario import Usuario


def _read_password() -> str:
    if sys.stdin.isatty():
        return getpass.getpass("Senha: ")
    return sys.stdin.readline().rstrip("\r\n")


async def main() -> None:
    if len(sys.argv) < 4:
        print(
            "Uso: python -m scripts.create_admin <email> <first_name> <last_name> [role]\n"
            "A senha é lida via stdin (silenciosa em modo interativo).",
            file=sys.stderr,
        )
        sys.exit(1)

    email = sys.argv[1]
    first_name = sys.argv[2]
    last_name = sys.argv[3]
    role = sys.argv[4] if len(sys.argv) > 4 else "admin"

    password = _read_password()
    if not password:
        print("Senha não pode ser vazia.", file=sys.stderr)
        sys.exit(1)

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
