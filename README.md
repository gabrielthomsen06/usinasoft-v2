# UsinaSoft v2

**Sistema corporativo de gestão de produção e financeiro para usinagem.**

Documento interno. Software proprietário — uso restrito à organização. A redistribuição, publicação ou cópia parcial deste código, sua documentação ou seus artefatos exige autorização formal.

---

## 1. Visão Geral

O UsinaSoft v2 é uma aplicação web corporativa que centraliza a operação de empresas de usinagem em três frentes:

- **Produção** — gestão de Ordens de Produção (OPs), peças e clientes, com acompanhamento de progresso em tempo real.
- **Financeiro** — contas a pagar e a receber, lançamentos, fornecedores e dashboard financeiro.
- **Fiscal** — importação automatizada de NF-e (XML modelo 55) e NFS-e (PDF — município de Joinville), com vínculo automático em contas a pagar/receber.

A solução substitui o controle por planilhas e anotações manuais por um sistema único, auditável, com base de dados relacional e acesso autenticado por usuário.

---

## 2. Objetivo do Projeto

Reduzir o retrabalho operacional e a perda de informação típicos de fluxos baseados em planilhas, oferecendo:

- Rastreabilidade ponta a ponta entre cliente → OP → peças → notas fiscais → contas.
- Visibilidade financeira consolidada (a pagar, a receber, lançamentos, fluxo de caixa).
- Padronização do processo fiscal de entrada via NF-e/NFS-e.
- Controle de acesso por papéis (admin × usuário).
- Plataforma única para gestão e operação, acessível por navegador.

---

## 3. Contexto de Negócio

| Tópico | Descrição |
|---|---|
| Setor | Indústria de usinagem sob encomenda |
| Stakeholders | Diretoria, administrativo, financeiro e produção |
| Documentos fiscais | NF-e (modelo 55) de entrada e NFS-e (Joinville/SC) de saída |
| Regime de dados | LGPD aplicável (clientes, fornecedores, usuários) |
| Tipo de operação | Multiusuário, transacional, web (HTTPS) |
| Modelo de licenciamento | Software interno proprietário |

---

## 4. Arquitetura em Alto Nível

```
                 Internet (HTTPS)
                       │
                       ▼
              ┌────────────────────┐
              │   Caddy (reverse   │   TLS automático
              │    proxy + ACME)   │   Termina HTTPS
              └─────────┬──────────┘
                        │
                        ▼
              ┌────────────────────┐
              │  Nginx (SPA host)  │   Serve build do frontend
              │    + proxy /api    │   Encaminha API
              └────┬───────────┬───┘
                   │           │
                   ▼           ▼
            ┌──────────┐  ┌──────────────┐
            │  React   │  │   FastAPI    │   API REST (Python)
            │   SPA    │  │   (async)    │
            └──────────┘  └──────┬───────┘
                                 │
                                 ▼
                          ┌────────────┐
                          │ PostgreSQL │   Modelo relacional
                          └────────────┘
```

Três camadas independentes (frontend SPA, backend API, banco), orquestradas por containers e isoladas em rede interna. Apenas o reverse proxy é exposto publicamente.

---

## 5. Tecnologias Utilizadas

### Backend
| Camada | Tecnologia |
|---|---|
| Linguagem | Python 3.11 |
| Framework Web | FastAPI |
| ORM | SQLAlchemy 2.x (assíncrono) |
| Migrations | Alembic |
| Autenticação | JWT (access + refresh) — `python-jose` + `passlib`/`bcrypt` |
| Validação | Pydantic v2 |
| Banco | PostgreSQL 15 |
| Parser fiscal | `defusedxml` (NF-e XML), `pymupdf` (NFS-e PDF) |

### Frontend
| Camada | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Estilização | Tailwind CSS |
| Roteamento | React Router DOM |
| Formulários | React Hook Form + Zod |
| HTTP | Axios |
| Ícones | Lucide React |

### Infraestrutura
| Camada | Tecnologia |
|---|---|
| Containers | Docker + Docker Compose |
| Reverse proxy / TLS | Caddy 2 (Let's Encrypt) |
| Web server estático | Nginx (Alpine) |

---

## 6. Responsabilidades dos Módulos

### Backend (`backend/app/`)
| Módulo | Responsabilidade |
|---|---|
| `api/routes/` | Endpoints HTTP por contexto (auth, usuários, clientes, OPs, peças, fornecedores, contas a pagar/receber, lançamentos, dashboard financeiro). |
| `api/deps.py` | Dependências comuns: sessão de banco, usuário autenticado, usuário ativo, usuário admin. |
| `core/config.py` | Configuração via env vars com validações fortes (chave secreta, CNPJ). |
| `core/security.py` | Hash de senha (bcrypt) e geração/validação de JWT. |
| `db/database.py` | Engine assíncrona, session factory, dependency de sessão por requisição. |
| `models/` | Modelos SQLAlchemy (`Usuario`, `Cliente`, `OrdemProducao`, `Peca`, `Fornecedor`, `ContaPagar`, `ContaReceber`, `Lancamento`, `NotaFiscal`). |
| `schemas/` | Schemas Pydantic de entrada/saída (validação e serialização). |
| `services/` | Regras de negócio por contexto, mantendo as rotas finas. |
| `services/nfe_parser.py` | Parsing seguro de XML de NF-e (modelo 55), com validação de status e chave de acesso. |
| `services/nfse_joinville_pdf_parser.py` | Parsing de NFS-e de Joinville a partir de PDF. |
| `services/nota_fiscal_service.py` | Orquestração de preview e importação fiscal, vinculando contas, fornecedores/clientes e parcelas. |
| `alembic/` | Versionamento do schema do banco. |

### Frontend (`frontend/src/`)
| Módulo | Responsabilidade |
|---|---|
| `pages/` | Telas: Login, Dashboard, Clientes, OPs, Peças, Fornecedores, Contas a Pagar/Receber, Lançamentos, Dashboard Financeiro. |
| `components/layout/` | Layout principal, sidebar e header autenticados. |
| `components/ui/` | Componentes visuais reutilizáveis (botões, inputs, modais, badges, toasts, cards). |
| `contexts/AuthContext.tsx` | Estado global de autenticação. |
| `hooks/` | Hooks utilitários (autenticação e demais). |
| `services/` | Camada de integração com a API (axios + interceptors). |
| `types/` | Contratos TypeScript compartilhados entre páginas e serviços. |

---

## 7. Domínios e Modelo de Dados (alto nível)

```
            ┌──────────┐         ┌───────────────────┐
            │ usuarios │         │ ordens_producao   │
            └──────────┘         └─────────┬─────────┘
                                           │ 1:N
                                           ▼
   ┌──────────┐  1:N  ┌──────────┐  N:1   ┌──────┐
   │ clientes │──────▶│  pecas   │◀───────│ OPs  │
   └──────────┘       └──────────┘        └──────┘

   ┌──────────────┐  1:N  ┌─────────────────┐
   │ fornecedores │──────▶│ contas_a_pagar  │
   └──────────────┘       └─────────────────┘

   ┌──────────┐  1:N  ┌────────────────────┐
   │ clientes │──────▶│ contas_a_receber   │
   └──────────┘       └────────────────────┘

                ┌──────────────┐
                │ lancamentos  │   (movimentos financeiros)
                └──────────────┘

                ┌──────────────┐
                │ notas_fiscais│   (rastro fiscal de cada importação)
                └──────────────┘
```

Entidades-chave: `Usuario`, `Cliente`, `Fornecedor`, `OrdemProducao`, `Peca`, `ContaPagar`, `ContaReceber`, `Lancamento`, `NotaFiscal`.

---

## 8. Fluxos Principais

### 8.1 Produção
1. Cadastro de cliente.
2. Criação da Ordem de Produção (vinculada ao cliente).
3. Cadastro de peças da OP, com prazo de entrega.
4. Acompanhamento de status por peça (`Em fila → Em andamento → Concluída`/`Pausada`/`Cancelada`).
5. Progresso da OP é calculado automaticamente a partir das peças.

### 8.2 Autenticação
1. Login (e-mail + senha) → emite **access token** e **refresh token**.
2. Acesso autenticado via header `Authorization: Bearer …`.
3. Renovação do access token via endpoint de refresh.
4. Criação de novos usuários restrita a administradores.

### 8.3 Financeiro
1. Cadastro de fornecedores e clientes.
2. Lançamento manual de contas a pagar/receber, com suporte a parcelamento.
3. Lançamentos financeiros refletem no Dashboard Financeiro (totais por período, por status).
4. Encerramento (baixa) das contas conforme pagamento/recebimento.

### 8.4 Importação Fiscal (NF-e / NFS-e)
1. Upload do XML (NF-e modelo 55) ou PDF (NFS-e Joinville).
2. Validação de tamanho e tipo de arquivo.
3. Parsing seguro e checagem de direção (emitida pela empresa → "a receber"; recebida pela empresa → "a pagar").
4. Detecção de duplicidade pela chave de acesso.
5. Sugestão automática de descrição, categoria e vínculo com fornecedor/cliente existente.
6. Confirmação gera o registro de `NotaFiscal` e as parcelas em `ContasPagar`/`ContasReceber`.

---

## 9. Controle de Acesso

| Papel | Permissões |
|---|---|
| `admin` | Acesso completo, incluindo gestão de usuários e módulos financeiro/fiscal. |
| `user` | Acesso à operação de produção (clientes, OPs, peças) e ao próprio perfil. Sem acesso aos módulos financeiro e fiscal. |

Proteções implementadas:
- Usuário não pode excluir a própria conta.
- Não é permitido excluir o último admin ativo do sistema.
- Endpoints fiscais e financeiros restritos a `admin`.

---

## 10. Superfície da API (resumo)

Prefixo único: `/api`.

| Domínio | Prefixo |
|---|---|
| Autenticação | `/api/auth/*` |
| Usuários | `/api/usuarios/*` |
| Clientes | `/api/clientes/*` |
| Ordens de Produção | `/api/ops/*` |
| Peças | `/api/pecas/*` |
| Fornecedores | `/api/fornecedores/*` |
| Contas a Receber | `/api/contas-receber/*` |
| Contas a Pagar | `/api/contas-pagar/*` |
| Lançamentos | `/api/lancamentos/*` |
| Dashboard Financeiro | `/api/dashboard-financeiro/*` |

A documentação interativa (`/docs`, `/redoc`) está disponível apenas com `DEBUG=true` (uso restrito a ambientes não produtivos).

---

## 11. Documentação Interna Relevante

| Documento | Conteúdo |
|---|---|
| `MELHORIAS.md` | Backlog técnico e roadmap interno de melhorias. |
| `docs/` | Documentação técnica e de processo (uso restrito). |
| `backend/alembic/` | Histórico de evolução do schema (migrations). |

A documentação operacional (deploy, rotação de credenciais, runbooks) é mantida fora deste repositório, em base interna restrita à equipe responsável.

---

## 12. Propriedade Intelectual

Este software, sua arquitetura, modelos de dados, código-fonte, documentação e quaisquer artefatos derivados são de propriedade exclusiva da organização. O acesso a este repositório é restrito a colaboradores autorizados e está sujeito às políticas internas de segurança e confidencialidade.
