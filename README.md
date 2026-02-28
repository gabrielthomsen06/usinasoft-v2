"# UsinaSoft 2.0

Sistema ERP para gestão de produção em usinagem. Desenvolvido com **FastAPI (Python)** no backend e **React (TypeScript)** no frontend.

## 🎨 Design System

- **Cor Principal:** `#f15a29` (laranja)
- **Cor Secundária:** `#333333` (cinza escuro)

## 🏗️ Estrutura do Projeto

```
usinasoft-v2/
├── backend/          # FastAPI + SQLAlchemy + PostgreSQL
├── frontend/         # React + TypeScript + Vite + Tailwind CSS
├── docker-compose.yml
└── README.md
```

## 🚀 Como Rodar

### Pré-requisitos

- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)

### 1. Clonar o repositório

```bash
git clone https://github.com/gabrielthomsen06/usinasoft-v2.git
cd usinasoft-v2
```

### 2. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env` com suas configurações.

### 3. Subir os serviços

```bash
docker-compose up --build
```

O sistema estará disponível em:
- **Frontend:** http://localhost:80
- **Backend API:** http://localhost:8000
- **Documentação da API:** http://localhost:8000/docs

### 4. Criar as tabelas do banco (primeira vez)

```bash
docker-compose exec backend alembic upgrade head
```

### 5. Registrar um usuário

Acesse http://localhost:8000/docs e use o endpoint `POST /api/auth/register` para criar o primeiro usuário.

## 🛠️ Desenvolvimento Local

### Backend (sem Docker)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
# Configure DATABASE_URL no .env
uvicorn app.main:app --reload
```

### Frontend (sem Docker)

```bash
cd frontend
npm install
npm run dev
```

O frontend em dev roda em http://localhost:5173

## 📋 Funcionalidades

### Autenticação
- Login com email e senha (JWT)
- Tokens: access (30min) + refresh (7 dias)
- Rotas protegidas no frontend

### Peças
- Cadastro completo de peças
- Associação automática com Ordem de Produção (por número de NF)
- Filtro por status
- Atualização de status

### Ordens de Produção (OPs)
- Criação automática ao cadastrar peça com número de NF
- Status calculado automaticamente com base nas peças
- Campos calculados: total de peças, concluídas, percentual

### Clientes
- CRUD completo

## 📚 Stack Tecnológica

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy 2.0 (async)
- Alembic (migrations)
- Pydantic v2
- python-jose (JWT)
- passlib + bcrypt
- asyncpg (PostgreSQL async)

### Frontend
- React 18
- TypeScript
- Vite
- React Router v6
- Axios
- React Hook Form + Zod
- Tailwind CSS
- Lucide React

### Infraestrutura
- PostgreSQL 15
- Docker + Docker Compose
- Nginx (frontend em produção)

## 🌐 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Registro |
| POST | /api/auth/refresh | Renovar token |
| GET | /api/usuarios/me | Dados do usuário atual |
| GET/POST | /api/clientes | Listar/criar clientes |
| GET/PUT/DELETE | /api/clientes/{id} | Ler/atualizar/deletar cliente |
| GET/POST | /api/pecas | Listar/criar peças |
| GET/PUT/DELETE | /api/pecas/{id} | Ler/atualizar/deletar peça |
| PATCH | /api/pecas/{id}/status | Atualizar status da peça |
| GET/POST | /api/ops | Listar/criar OPs |
| GET/PUT/DELETE | /api/ops/{id} | Ler/atualizar/deletar OP |

Acesse http://localhost:8000/docs para a documentação interativa completa (Swagger UI)." 
