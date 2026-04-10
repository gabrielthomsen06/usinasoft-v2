#!/bin/sh
set -e

echo "Aguardando banco de dados..."
# O depends_on com healthcheck já garante, mas por segurança:
sleep 2

echo "Rodando migrations..."
alembic upgrade head

echo "Iniciando servidor..."
if [ "$DEBUG" = "true" ] || [ "$DEBUG" = "True" ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
fi
