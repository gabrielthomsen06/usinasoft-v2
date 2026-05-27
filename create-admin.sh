#!/bin/bash
# ============================================
#  Criar usuário administrador
#
#  A senha é lida em prompt silencioso (read -s) e enviada ao
#  container via stdin (docker exec -i). Ela NUNCA é interpolada
#  em código Python nem aparece em argv/ps.
# ============================================
set -euo pipefail

CONTAINER="${USINASOFT_BACKEND_CONTAINER:-usinasoft_backend}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "Container '$CONTAINER' não está em execução." >&2
    exit 1
fi

echo "=== Criar Usuário Admin ==="
echo

read -r -p "Email: " ADMIN_EMAIL
read -r -p "Primeiro nome: " ADMIN_FIRST
read -r -p "Último nome: " ADMIN_LAST
read -r -s -p "Senha: " ADMIN_PASS
echo

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_FIRST" ] || [ -z "$ADMIN_LAST" ] || [ -z "$ADMIN_PASS" ]; then
    echo "Todos os campos são obrigatórios." >&2
    exit 1
fi

printf '%s\n' "$ADMIN_PASS" | docker exec -i "$CONTAINER" \
    python -m scripts.create_admin "$ADMIN_EMAIL" "$ADMIN_FIRST" "$ADMIN_LAST" admin

echo
echo "Pronto! Acesse o sistema e faça login."
