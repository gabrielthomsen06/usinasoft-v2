# UsinaSoft v2

**Sistema de Gerenciamento de Producao para Usinagem**

O UsinaSoft v2 e um ERP web desenvolvido para empresas de usinagem que precisam controlar suas ordens de producao, pecas e clientes de forma organizada e eficiente.

---

## Sobre o Sistema

O UsinaSoft resolve o problema de controle de producao em empresas de usinagem, onde e comum o uso de planilhas ou anotacoes manuais para rastrear pedidos, pecas e prazos de entrega. Com ele, o gestor tem visao completa da operacao em tempo real.

### Principais Funcionalidades

| Modulo | Descricao |
|--------|-----------|
| **Dashboard** | Visao geral com metricas: total de pecas, pecas concluidas, OPs abertas, clientes cadastrados e barra de progresso |
| **Clientes** | Cadastro completo com nome, contato, e-mail e endereco. Busca por nome, e-mail ou contato |
| **Ordens de Producao (OPs)** | Criacao e gestao de OPs com codigo, cliente vinculado, status e observacoes. Progresso automatico baseado nas pecas |
| **Pecas** | Cadastro detalhado com codigo, descricao, pedido/NF, quantidade, data de entrega e status. Filtros por status e busca |
| **Autenticacao** | Login seguro com JWT (access + refresh token). Registro protegido (so usuarios logados criam novas contas) |

### Status Disponiveis

**Ordens de Producao:**
- `Aberta` — OP criada, aguardando inicio
- `Em Andamento` — Pecas sendo produzidas
- `Concluida` — Todas as pecas finalizadas

**Pecas:**
- `Em Fila` — Aguardando inicio da producao
- `Em Andamento` — Sendo produzida
- `Pausada` — Producao temporariamente parada
- `Concluida` — Peca finalizada
- `Cancelada` — Producao cancelada

---

## Fluxograma do Sistema

### Navegacao Geral

```
                    +------------------+
                    |  Usuario acessa  |
                    |    o sistema     |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |  Tela de Login   |
                    |  (email + senha) |
                    +--------+---------+
                             |
                     autenticacao JWT
                             |
                             v
                    +------------------+
                    |    Dashboard     |
                    | (visao geral)    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
     +--------+---+  +------+------+  +----+--------+
     |  Clientes  |  |     OPs     |  |    Pecas    |
     +--------+---+  +------+------+  +----+--------+
              |              |              |
              v              v              v
     +--------+---+  +------+------+  +----+--------+
     | Cadastrar  |  | Criar OP    |  | Cadastrar   |
     | Editar     |  | Vincular    |  | Alterar     |
     | Excluir    |  | cliente     |  | status      |
     | Buscar     |  | Acompanhar  |  | Excluir     |
     +------------+  | progresso   |  | Filtrar     |
                     +-------------+  +-------------+
```

### Fluxo de Producao (Passo a Passo)

```
  1. CADASTRAR CLIENTE          2. CRIAR OP                  3. CADASTRAR PECAS
  +---------------------+      +---------------------+      +---------------------+
  | Nome: Empresa ABC   |      | Codigo: OP-2026-001 |      | Codigo: PC-001      |
  | Contato: (11) 9999  | ---> | Cliente: Empresa ABC| ---> | OP: OP-2026-001     |
  | Email: abc@mail.com |      | Status: Aberta      |      | Qtd: 50             |
  +---------------------+      +---------------------+      | Entrega: 30/04/2026 |
                                                             | Status: Em Fila     |
                                                             +---------------------+

  4. ACOMPANHAR PRODUCAO        5. ATUALIZAR STATUS          6. CONCLUSAO
  +---------------------+      +---------------------+      +---------------------+
  | Dashboard mostra:   |      | Peca PC-001:        |      | OP-2026-001:        |
  | - 50 pecas total    |      | Em Fila             |      | Status: Concluida   |
  | - 0 concluidas      | ---> | -> Em Andamento     | ---> | Progresso: 100%     |
  | - Progresso: 0%     |      | -> Concluida        |      | 50/50 pecas         |
  +---------------------+      +---------------------+      +---------------------+
```

### Fluxo de Autenticacao

```
  +----------+     POST /api/auth/login      +---------+     Valida email/senha    +----------+
  |          | ----(email + password)-------> |         | -----------------------> |          |
  | Frontend |                                | Backend |                          | Database |
  |          | <----(access_token +           |         | <----(usuario)---------- |          |
  +----------+      refresh_token)            +---------+                          +----------+
       |                                           |
       | Armazena tokens                           | Verifica JWT em
       | no localStorage                           | cada request
       |                                           |
       +------- Authorization: Bearer token ------>+
```

---

## Arquitetura

```
  Internet
     |
     v
  +------------------+
  |  Caddy (HTTPS)   |  Porta 80/443 — Reverse Proxy + SSL automatico
  +--------+---------+
           |
           v
  +------------------+
  |  Nginx (Frontend)|  Serve o React SPA (arquivos estaticos)
  |  + Proxy /api    |  Redireciona /api/* para o Backend
  +--------+---------+
           |
     +-----+------+
     |            |
     v            v
  +------+   +--------+
  | React|   | FastAPI|  Backend Python — API REST
  | SPA  |   |  API   |
  +------+   +---+----+
                  |
                  v
           +------------+
           | PostgreSQL  |  Banco de dados relacional
           +------------+
```

### Stack Tecnologica

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| **Frontend** | React + TypeScript | 18.x |
| **Estilizacao** | Tailwind CSS | 3.4 |
| **Icones** | Lucide React | 0.309 |
| **Formularios** | React Hook Form + Zod | 7.x |
| **HTTP Client** | Axios | 1.6 |
| **Roteamento** | React Router DOM | 6.x |
| **Backend** | FastAPI (Python) | 0.109 |
| **ORM** | SQLAlchemy (async) | 2.0 |
| **Migrations** | Alembic | 1.13 |
| **Auth** | JWT (python-jose) + bcrypt | — |
| **Banco de Dados** | PostgreSQL | 15 |
| **Reverse Proxy** | Caddy | 2.x |
| **Web Server** | Nginx | Alpine |
| **Containers** | Docker + Docker Compose | 29.x |

---

## Estrutura do Projeto

```
usinasoft-v2/
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |   |-- deps.py              # Dependencias (auth, DB session)
|   |   |   |-- routes/
|   |   |       |-- auth.py          # Login, registro, refresh token
|   |   |       |-- clientes.py      # CRUD clientes
|   |   |       |-- ops.py           # CRUD ordens de producao
|   |   |       |-- pecas.py         # CRUD pecas + status
|   |   |       |-- usuarios.py      # Perfil e gestao de usuarios
|   |   |-- core/
|   |   |   |-- config.py            # Configuracoes (env vars)
|   |   |   |-- security.py          # Hash de senha, JWT
|   |   |-- db/
|   |   |   |-- database.py          # Engine async, session factory
|   |   |-- models/
|   |   |   |-- cliente.py           # Modelo Cliente
|   |   |   |-- ordem_producao.py    # Modelo OrdemProducao
|   |   |   |-- peca.py              # Modelo Peca
|   |   |   |-- usuario.py           # Modelo Usuario
|   |   |-- schemas/
|   |   |   |-- cliente.py           # Schemas Pydantic
|   |   |   |-- ordem_producao.py    # Schemas com campos computados
|   |   |   |-- peca.py              # Schemas Pydantic
|   |   |   |-- usuario.py           # Schemas Pydantic
|   |   |-- services/
|   |   |   |-- auth_service.py      # Logica de autenticacao
|   |   |   |-- cliente_service.py   # Logica de negocios clientes
|   |   |   |-- op_service.py        # Logica de negocios OPs
|   |   |   |-- peca_service.py      # Logica de negocios pecas
|   |   |   |-- usuario_service.py   # Logica de negocios usuarios
|   |   |-- main.py                  # App FastAPI, middlewares, rotas
|   |-- alembic/                     # Migrations do banco
|   |-- requirements.txt
|   |-- Dockerfile
|
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |   |-- layout/              # Layout, Sidebar, Header
|   |   |   |-- ui/                  # Button, Input, Modal, Badge, Toast, Card
|   |   |-- contexts/
|   |   |   |-- AuthContext.tsx       # Contexto de autenticacao
|   |   |-- hooks/
|   |   |   |-- useAuth.ts           # Hook de autenticacao
|   |   |-- pages/
|   |   |   |-- Login.tsx            # Tela de login
|   |   |   |-- Dashboard.tsx        # Dashboard com metricas
|   |   |   |-- Clientes.tsx         # Gestao de clientes
|   |   |   |-- Ops.tsx              # Gestao de OPs
|   |   |   |-- Pecas.tsx            # Gestao de pecas
|   |   |-- services/
|   |   |   |-- api.ts               # Axios instance + interceptors
|   |   |   |-- auth.ts              # Servico de autenticacao
|   |   |   |-- clientes.ts          # Servico de clientes
|   |   |   |-- ops.ts               # Servico de OPs
|   |   |   |-- pecas.ts             # Servico de pecas
|   |   |-- types/
|   |       |-- index.ts             # Interfaces TypeScript
|   |-- Dockerfile
|   |-- nginx.conf
|
|-- docker-compose.yml               # Ambiente local (dev)
|-- docker-compose.prod.yml          # Ambiente de producao
|-- Caddyfile                         # Config do Caddy (HTTPS)
|-- .env.production                   # Template de variaveis
|-- deploy.sh                         # Script de setup do servidor
|-- start.sh                          # Script de start da aplicacao
|-- create-admin.sh                   # Script para criar usuario admin
```

---

## API Endpoints

### Autenticacao
| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/auth/login` | Login (retorna tokens) | Nao |
| POST | `/api/auth/register` | Criar usuario | Sim |
| POST | `/api/auth/refresh` | Renovar token | Nao |

### Usuarios
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/usuarios/me` | Perfil do usuario logado |
| PUT | `/api/usuarios/me` | Atualizar perfil |
| GET | `/api/usuarios/` | Listar todos |
| GET | `/api/usuarios/{id}` | Buscar por ID |
| DELETE | `/api/usuarios/{id}` | Remover |

### Clientes
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/clientes/` | Listar todos |
| POST | `/api/clientes/` | Criar |
| GET | `/api/clientes/{id}` | Buscar por ID |
| PUT | `/api/clientes/{id}` | Atualizar |
| DELETE | `/api/clientes/{id}` | Remover |

### Ordens de Producao
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/ops/` | Listar todas |
| POST | `/api/ops/` | Criar |
| GET | `/api/ops/{id}` | Buscar por ID (inclui pecas) |
| PUT | `/api/ops/{id}` | Atualizar |
| DELETE | `/api/ops/{id}` | Remover |

### Pecas
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/pecas/` | Listar (filtro por status) |
| POST | `/api/pecas/` | Criar |
| GET | `/api/pecas/{id}` | Buscar por ID |
| PUT | `/api/pecas/{id}` | Atualizar |
| PATCH | `/api/pecas/{id}/status` | Alterar status |
| DELETE | `/api/pecas/{id}` | Remover |

---

## Como Usar

### Requisitos
- Docker e Docker Compose instalados

### Ambiente Local (Desenvolvimento)
```bash
git clone https://github.com/gabrielthomsen06/usinasoft-v2.git
cd usinasoft-v2

docker compose up -d --build
docker exec usinasoft_backend alembic upgrade head

# Acessar: http://localhost
```

### Ambiente de Producao (DigitalOcean)
```bash
cd /opt/usinasoft
cp .env.production .env
nano .env  # preencher variaveis

chmod +x start.sh create-admin.sh
./start.sh
./create-admin.sh
```

---

## Modelo de Dados

```
  +------------+       +------------------+       +------------+
  |  usuarios  |       | ordens_producao  |       |  clientes  |
  +------------+       +------------------+       +------------+
  | id (UUID)  |       | id (UUID)        |       | id (UUID)  |
  | email      |       | codigo (unique)  |  +--->| nome       |
  | password   |       | cliente_id (FK)  |--+    | contato    |
  | first_name |       | status (enum)    |       | email      |
  | last_name  |       | observacoes      |       | endereco   |
  | is_active  |       | created_at       |       | created_at |
  | created_at |       | updated_at       |       | updated_at |
  | updated_at |       +--------+---------+       +-----+------+
  +------------+                |                        |
                                | 1:N                    | 1:N
                                v                        v
                         +------------+           (tambem referenciado
                         |   pecas    |            por pecas.cliente_id)
                         +------------+
                         | id (UUID)             |
                         | ordem_producao_id (FK)|
                         | cliente_id (FK)       |
                         | codigo (unique)       |
                         | descricao             |
                         | pedido                |
                         | quantidade            |
                         | data_entrega          |
                         | status (enum)         |
                         | created_at            |
                         | updated_at            |
                         +-----------------------+
```

---

## Infraestrutura de Producao

| Componente | Detalhe |
|------------|---------|
| **Provedor** | DigitalOcean |
| **Servidor** | Droplet 2GB RAM, 1 vCPU, 35GB NVMe SSD |
| **SO** | Ubuntu 22.04 LTS |
| **IP** | 165.22.190.242 |
| **Backup** | Diario automatico (retencao 7 dias) |
| **Firewall** | UFW (portas 22, 80, 443) |
| **Swap** | 2GB |
| **Custo** | ~$18.40/mes |
