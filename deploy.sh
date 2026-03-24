#!/bin/bash
set -e

# ============================================
#  UsinaSoft v2 — Script de Deploy
#  Uso: ssh root@SEU_IP "bash -s" < deploy.sh
# ============================================

echo "============================================"
echo "  UsinaSoft v2 — Deploy Automatizado"
echo "============================================"
echo ""

# ─── 1. Atualizar sistema ───
echo ">>> Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ─── 2. Instalar Docker (se não existir) ───
if ! command -v docker &> /dev/null; then
    echo ">>> Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo ">>> Docker instalado com sucesso!"
else
    echo ">>> Docker já instalado."
fi

# ─── 3. Instalar Docker Compose plugin (se não existir) ───
if ! docker compose version &> /dev/null; then
    echo ">>> Instalando Docker Compose plugin..."
    apt-get install -y -qq docker-compose-plugin
fi

# ─── 4. Configurar firewall ───
echo ">>> Configurando firewall..."
apt-get install -y -qq ufw
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable
echo ">>> Firewall configurado (portas 22, 80, 443)"

# ─── 5. Criar diretório do projeto ───
APP_DIR="/opt/usinasoft"
echo ">>> Criando diretório $APP_DIR..."
mkdir -p $APP_DIR

echo ""
echo "============================================"
echo "  Servidor pronto!"
echo "============================================"
echo ""
echo "Próximos passos:"
echo ""
echo "  1. Envie o projeto para o servidor:"
echo "     scp -r ./* root@SEU_IP:$APP_DIR/"
echo ""
echo "  2. Acesse o servidor:"
echo "     ssh root@SEU_IP"
echo ""
echo "  3. Configure o .env:"
echo "     cd $APP_DIR"
echo "     cp .env.production .env"
echo "     nano .env   # preencha os valores"
echo ""
echo "  4. Suba a aplicação:"
echo "     docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "  5. Rode as migrations do banco:"
echo "     docker exec usinasoft_backend alembic upgrade head"
echo ""
echo "  6. Crie o primeiro usuário admin:"
echo "     docker exec -it usinasoft_backend python -c \""
echo "     import asyncio"
echo "     from app.db.database import AsyncSessionLocal"
echo "     from app.services.usuario_service import create_usuario"
echo "     from app.schemas.usuario import UsuarioCreate"
echo "     async def main():"
echo "         async with AsyncSessionLocal() as db:"
echo "             user = await create_usuario(db, UsuarioCreate("
echo "                 email='admin@empresa.com.br',"
echo "                 password='trocar123',"
echo "                 first_name='Admin',"
echo "                 last_name='UsinaSoft'"
echo "             ))"
echo "             await db.commit()"
echo "             print(f'Usuário criado: {user.email}')"
echo "     asyncio.run(main())"
echo "     \""
echo ""
echo "============================================"
