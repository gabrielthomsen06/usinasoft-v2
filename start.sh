#!/bin/bash
set -e

# ============================================
#  UsinaSoft v2 — Start / Restart
# ============================================

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "ERRO: Arquivo .env não encontrado!"
    echo "Execute: cp .env.production .env && nano .env"
    exit 1
fi

# Carregar variáveis
source .env

echo ">>> Domínio: $DOMAIN"
echo ">>> Banco: $POSTGRES_DB"
echo ">>> Debug: $DEBUG"
echo ""

# Build e start
echo ">>> Construindo e iniciando containers..."
docker compose -f docker-compose.prod.yml up -d --build

# Aguardar banco ficar pronto
echo ">>> Aguardando banco de dados..."
sleep 5

# Rodar migrations
echo ">>> Rodando migrations..."
docker exec usinasoft_backend alembic upgrade head

echo ""
echo "============================================"
echo "  UsinaSoft v2 rodando!"
echo "  Acesse: https://$DOMAIN"
echo "============================================"
