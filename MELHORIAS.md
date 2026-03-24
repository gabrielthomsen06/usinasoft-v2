# Mapeamento de Melhorias — UsinaSoft v2

Levantamento completo de melhorias possiveis, organizadas por prioridade e area.

---

## Prioridade ALTA (Impacto direto no uso diario)

### 1. Confirmacao antes de excluir (Clientes e OPs)
- **Situacao atual:** Ao clicar em excluir, o item e removido imediatamente sem confirmacao
- **Melhoria:** Adicionar modal de confirmacao "Tem certeza?" (como ja existe em Pecas)
- **Impacto:** Evita exclusoes acidentais

### 2. Paginacao nas listagens
- **Situacao atual:** Todas as listagens carregam todos os registros de uma vez (`limit=100`)
- **Melhoria:** Implementar paginacao real com controles (anterior/proximo) e indicador de pagina
- **Impacto:** Performance e usabilidade com muitos registros

### 3. Dominio e HTTPS
- **Situacao atual:** Acesso apenas por IP (http://165.22.190.242)
- **Melhoria:** Configurar dominio proprio com certificado SSL (Caddy ja esta preparado)
- **Impacto:** Profissionalismo, seguranca, SEO

### 4. Niveis de permissao (Roles)
- **Situacao atual:** Todos os usuarios tem acesso total ao sistema
- **Melhoria:** Criar roles (admin, operador, visualizador) com permissoes diferentes
- **Impacto:** Seguranca e controle de acesso

### 5. Gestao de usuarios no frontend
- **Situacao atual:** Usuarios so podem ser criados via API/script. Nao tem tela de gestao
- **Melhoria:** Tela para listar, criar, editar, desativar e alterar senha de usuarios
- **Impacto:** Autonomia do administrador

---

## Prioridade MEDIA (Melhoram significativamente a experiencia)

### 6. Dashboard com graficos
- **Situacao atual:** Dashboard mostra apenas numeros e listas
- **Melhoria:** Adicionar graficos (pecas por status, producao por mes, OPs por cliente)
- **Tecnologia sugerida:** Recharts ou Chart.js

### 7. Historico/log de alteracoes
- **Situacao atual:** Nao existe registro de quem fez o que
- **Melhoria:** Tabela de auditoria com usuario, acao, data e detalhes da alteracao
- **Impacto:** Rastreabilidade

### 8. Busca global
- **Situacao atual:** Busca funciona apenas dentro de cada pagina
- **Melhoria:** Barra de busca global no header que pesquisa em clientes, OPs e pecas simultaneamente
- **Impacto:** Agilidade na navegacao

### 9. Notificacoes de prazo
- **Situacao atual:** Nao existe alerta de prazo de entrega proximo ou vencido
- **Melhoria:** Indicadores visuais (vermelho para atrasadas, amarelo para proximas do prazo) + notificacoes no dashboard
- **Impacto:** Prevencao de atrasos

### 10. Exportar para Excel/PDF
- **Situacao atual:** Dados so podem ser visualizados no sistema
- **Melhoria:** Botao de exportar listas para Excel (.xlsx) e relatorios em PDF
- **Impacto:** Compartilhamento de dados, relatorios para clientes

### 11. Alterar status da OP automaticamente
- **Situacao atual:** Status da OP precisa ser alterado manualmente
- **Melhoria:** Quando todas as pecas de uma OP forem concluidas, alterar automaticamente para "Concluida". Quando a primeira peca iniciar, alterar para "Em Andamento"
- **Impacto:** Menos trabalho manual, dados mais precisos

### 12. Filtro por data de entrega
- **Situacao atual:** Nao e possivel filtrar pecas por data de entrega
- **Melhoria:** Filtro por periodo (esta semana, proximo mes, atrasadas)
- **Impacto:** Planejamento de producao

### 13. Upload de arquivos/desenhos tecnicos
- **Situacao atual:** Nao existe upload de arquivos
- **Melhoria:** Permitir anexar PDFs, imagens ou arquivos DWG/DXF nas pecas
- **Impacto:** Centralizacao de informacoes

---

## Prioridade BAIXA (Nice-to-have, podem ser feitas depois)

### 14. Tema escuro (Dark mode)
- **Situacao atual:** Apenas tema claro
- **Melhoria:** Opcao de alternar entre tema claro e escuro
- **Impacto:** Conforto visual

### 15. App mobile (PWA)
- **Situacao atual:** Sistema e responsivo mas nao funciona offline
- **Melhoria:** Transformar em PWA com service worker para acesso offline basico e notificacoes push
- **Impacto:** Acesso no chao de fabrica

### 16. Relatorios e metricas avancadas
- **Situacao atual:** Dashboard basico
- **Melhoria:** Pagina dedicada de relatorios: producao por periodo, tempo medio por peca, taxa de cancelamento, ranking de clientes
- **Impacto:** Tomada de decisao

### 17. Integracao com WhatsApp
- **Situacao atual:** Comunicacao com cliente e manual
- **Melhoria:** Notificacoes automaticas via WhatsApp quando peca/OP mudar de status ou ficar pronta
- **Tecnologia sugerida:** API do WhatsApp Business ou Evolution API

### 18. Kanban visual para pecas
- **Situacao atual:** Pecas sao exibidas em tabela
- **Melhoria:** Visao kanban com colunas (Em Fila > Em Andamento > Concluida) e drag-and-drop
- **Impacto:** Visao mais intuitiva do fluxo

### 19. Ordem de prioridade nas pecas
- **Situacao atual:** Pecas nao tem campo de prioridade
- **Melhoria:** Campo de prioridade (baixa, media, alta, urgente) com ordenacao e indicador visual
- **Impacto:** Gestao de prioridades

### 20. Multi-empresa (SaaS)
- **Situacao atual:** Sistema single-tenant (uma empresa)
- **Melhoria:** Suporte multi-tenant para atender varias empresas com dados isolados
- **Impacto:** Modelo de negocio escalavel

### 21. Backup automatico do banco para nuvem
- **Situacao atual:** Backup do Droplet (imagem completa)
- **Melhoria:** Backup automatico diario do PostgreSQL para S3/Spaces com retencao configuravel
- **Impacto:** Seguranca dos dados

### 22. Monitoramento e alertas
- **Situacao atual:** Sem monitoramento
- **Melhoria:** Configurar UptimeRobot ou similar para monitorar se o site esta no ar, alertas por email/Telegram
- **Impacto:** Disponibilidade

### 23. Testes automatizados
- **Situacao atual:** Nenhum teste automatizado
- **Melhoria:** Testes unitarios no backend (pytest) e testes e2e no frontend (Playwright ou Cypress)
- **Impacto:** Qualidade e confianca no codigo

### 24. CI/CD (Deploy automatico)
- **Situacao atual:** Deploy manual via SSH + docker compose
- **Melhoria:** Pipeline GitHub Actions que faz build, testa e deploy automaticamente ao fazer push na branch main
- **Impacto:** Agilidade no deploy

### 25. Impressao de etiquetas
- **Situacao atual:** Nao existe
- **Melhoria:** Gerar etiquetas com QR code para pecas, permitindo leitura no chao de fabrica
- **Impacto:** Rastreabilidade fisica

---

## Resumo por Area

| Area | Melhorias | IDs |
|------|-----------|-----|
| **Frontend/UX** | 8 | 1, 2, 6, 8, 14, 15, 18, 25 |
| **Backend/Logica** | 6 | 4, 7, 11, 19, 20, 23 |
| **Integracao** | 3 | 10, 13, 17 |
| **Infraestrutura** | 4 | 3, 21, 22, 24 |
| **Relatorios** | 2 | 12, 16 |
| **Gestao** | 2 | 5, 9 |

---

## Sugestao de Roadmap

**Fase 1 — Essencial (1-2 semanas)**
- [ ] #1 Confirmacao antes de excluir
- [ ] #2 Paginacao
- [ ] #5 Tela de gestao de usuarios
- [ ] #11 Status automatico da OP

**Fase 2 — Profissionalizacao (2-4 semanas)**
- [ ] #3 Dominio + HTTPS
- [ ] #4 Niveis de permissao
- [ ] #6 Dashboard com graficos
- [ ] #9 Notificacoes de prazo
- [ ] #10 Exportar Excel/PDF

**Fase 3 — Diferencial (1-2 meses)**
- [ ] #7 Historico de alteracoes
- [ ] #8 Busca global
- [ ] #12 Filtro por data
- [ ] #13 Upload de arquivos
- [ ] #22 Monitoramento

**Fase 4 — Escala (2-3 meses)**
- [ ] #16 Relatorios avancados
- [ ] #17 Integracao WhatsApp
- [ ] #18 Kanban visual
- [ ] #23 Testes automatizados
- [ ] #24 CI/CD
