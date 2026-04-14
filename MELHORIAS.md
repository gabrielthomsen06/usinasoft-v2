# Mapeamento de Melhorias — UsinaSoft v2

Roadmap de evolucao do sistema apos o deploy em producao e o fechamento do modulo financeiro. Ideias agrupadas por area, com prioridade sugerida.

Ultima atualizacao: 2026-04-14

---

## 1. Integracao Producao <-> Financeiro (ALTA)

O ponto mais forte do sistema hoje e que as duas pontas existem — falta costurar.

### 1.1. Gerar conta a receber automaticamente ao concluir OP
- Ao mudar OP para "Concluida", abrir modal pre-preenchido para emitir conta a receber para o cliente da OP (valor, vencimento, parcelamento).
- Vincular a conta a receber a OP de origem (coluna `ordem_producao_id` em `contas_receber`).
- **Beneficio:** zero retrabalho de digitacao, rastreabilidade completa.

### 1.2. Custo real da OP
- Campo de custo de materia-prima + apontamento de horas trabalhadas por peca.
- Dashboard mostra margem real (preco cobrado - custo) por OP.
- **Beneficio:** precificacao baseada em dado, nao em achismo.

### 1.3. Orcamento -> Aprovacao -> OP
- Fluxo novo: cadastrar orcamento, gerar PDF, enviar ao cliente, aprovar e converter em OP com um clique.
- Status: rascunho, enviado, aprovado, rejeitado, convertido.
- **Beneficio:** formaliza a venda antes de virar producao.

---

## 2. Modulo Financeiro — Evolucoes (ALTA/MEDIA)

### 2.1. Fluxo de caixa projetado (ALTA)
- Grafico de saldo projetado para os proximos 30/60/90 dias, somando contas a pagar e a receber em aberto.
- Alerta quando saldo projetado ficar negativo.

### 2.2. Despesas recorrentes (ALTA)
- Cadastrar despesas fixas (aluguel, energia, internet) e gerar automaticamente a conta a pagar todo mes.

### 2.3. Anexar comprovante/NF em lancamento (MEDIA)
- Upload de PDF ou imagem vinculado a cada lancamento/conta.
- **Beneficio:** auditoria e organizacao contabil.

### 2.4. Conciliacao bancaria (MEDIA)
- Importar extrato OFX/CSV e casar automaticamente com lancamentos.

### 2.5. DRE mensal simplificado (MEDIA)
- Relatorio de receitas x despesas x resultado por mes, com comparativo entre meses.

### 2.6. Centro de custos (BAIXA)
- Classificar lancamentos por projeto/OP/departamento para analise de rentabilidade.

---

## 3. Producao e Chao de Fabrica (ALTA/MEDIA)

### 3.1. Apontamento de horas por peca (ALTA)
- Operador registra inicio e fim de producao de cada peca (ou tempo manual).
- Base para custeio real e para identificar gargalos.

### 3.2. Controle de estoque de materia-prima (ALTA)
- Cadastro de materia-prima (chapa, barra, etc) com saldo atual.
- Baixa automatica ao iniciar peca, alerta de estoque minimo.

### 3.3. Lista tecnica (BOM) por peca (MEDIA)
- Definir quais materias-primas e quantidades cada peca consome.

### 3.4. Kanban visual de pecas (MEDIA)
- Colunas: Em Fila -> Em Andamento -> Concluida, com drag-and-drop.
- Alternativa a tabela atual.

### 3.5. Etiquetas com QR code para pecas (MEDIA)
- Imprimir etiqueta por peca; operador escaneia para mudar status/apontar hora.

### 3.6. Prioridade e urgencia na peca (BAIXA)
- Campo de prioridade (baixa/media/alta/urgente) com destaque visual.

---

## 4. Gestao Comercial e Clientes (MEDIA)

### 4.1. Ficha do cliente com historico completo
- Pagina do cliente mostrando: OPs ja feitas, faturamento total, ticket medio, inadimplencia.

### 4.2. Tabela de preco por cliente
- Precos diferenciados por cliente ou grupo de clientes.

### 4.3. Follow-up de orcamentos
- Lista de orcamentos enviados mas nao aprovados, com data do ultimo contato.

---

## 5. Relatorios e BI (MEDIA)

### 5.1. Relatorio de lucratividade por OP
- Quanto custou x quanto foi cobrado x margem.

### 5.2. Tempo medio de entrega
- Prazo prometido x prazo real, por cliente e por tipo de peca.

### 5.3. Ranking de clientes e pecas
- Top 10 clientes por faturamento, top 10 pecas mais produzidas.

### 5.4. Exportar qualquer listagem em Excel e PDF
- Botao de exportar em todas as telas de lista.

---

## 6. UX e Produtividade (MEDIA/BAIXA)

### 6.1. Busca global (Ctrl+K)
- Barra de busca unica que pesquisa em clientes, OPs, pecas, fornecedores, lancamentos.

### 6.2. Notificacoes no header
- Sino com alertas: contas vencendo, OPs atrasadas, pecas paradas.

### 6.3. Paginacao real
- Substituir o `limit=100` atual por paginacao com controle de pagina e tamanho.

### 6.4. Filtros avancados e salvos
- Filtro por periodo, status, cliente, etc; opcao de salvar filtro usado com frequencia.

### 6.5. Dark mode (BAIXA)

### 6.6. Atalhos de teclado (BAIXA)
- Novo registro, salvar, buscar, navegar entre abas.

---

## 7. Integracoes (MEDIA)

### 7.1. Emissao de NFe/NFSe
- Via integracao (Tecnospeed, eNotas, Focus NFe).
- **Beneficio:** eliminar digitacao paralela no sistema da prefeitura/SEFAZ.

### 7.2. WhatsApp automatico
- Avisar cliente quando OP mudar de status (em producao, concluida, nota emitida).
- Enviar boleto/cobranca via WhatsApp.

### 7.3. E-mail automatico
- Envio de orcamento em PDF, cobranca, confirmacao de recebimento.

### 7.4. Importacao de pedido via planilha
- Upload de Excel para cadastrar varias pecas de uma OP de uma vez.

---

## 8. Governanca e Seguranca (ALTA/MEDIA)

### 8.1. Log de auditoria (ALTA)
- Tabela registrando quem fez o que, quando, com diff antes/depois.
- Visivel na ficha de cada registro.

### 8.2. Tela de gestao de usuarios no frontend (ALTA)
- Listar, criar, editar, desativar, trocar senha, mudar role.
- Hoje isso so existe via script no servidor.

### 8.3. Permissoes por role no frontend (ALTA)
- Operador nao ve modulo financeiro, visualizador nao edita, etc.

### 8.4. Backup automatico do Postgres para nuvem (ALTA)
- Cron diario gerando dump e enviando para Spaces/S3 com retencao.

### 8.5. Monitoramento e alertas (MEDIA)
- UptimeRobot para uptime + Sentry (ou similar) para erros em producao.

### 8.6. 2FA para admin (BAIXA)

---

## 9. Infra e DevOps (MEDIA/BAIXA)

### 9.1. CI/CD via GitHub Actions
- Push em main -> build -> deploy automatico no droplet.

### 9.2. Ambiente de staging
- Segundo droplet ou compose alternativo para testar antes de producao.

### 9.3. Testes automatizados
- Pytest no backend (services criticos e fluxos financeiros), Playwright para fluxos principais no frontend.

### 9.4. Logs centralizados
- Stack simples (Loki/Grafana ou apenas persistencia dos logs do compose).

---

## 10. Mobile e PWA (BAIXA)

### 10.1. PWA instalavel
- Acesso offline basico de consultas, notificacoes push.

### 10.2. App dedicado para chao de fabrica
- Tela kiosk simplificada com QR scanner para apontamento rapido.

---

## 11. Escala Futura (BAIXA)

### 11.1. Multi-tenant (SaaS)
- Preparar o sistema para atender varias empresas em uma unica instancia.

### 11.2. Multi-filial
- Uma empresa com mais de uma unidade produtiva.

---

## Sugestao de Roadmap por Trimestre

**Q2/2026 — Amarrar producao e financeiro**
- 1.1 Conta a receber automatica da OP
- 2.1 Fluxo de caixa projetado
- 2.2 Despesas recorrentes
- 8.1 Log de auditoria
- 8.2 Gestao de usuarios no frontend
- 8.4 Backup automatico

**Q3/2026 — Custo real e chao de fabrica**
- 1.2 Custo real da OP
- 3.1 Apontamento de horas
- 3.2 Estoque de materia-prima
- 5.1 Relatorio de lucratividade
- 5.4 Exportacao Excel/PDF

**Q4/2026 — Comercial e integracoes**
- 1.3 Orcamento -> OP
- 7.1 Emissao de NFe/NFSe
- 7.2 WhatsApp
- 4.1 Ficha completa do cliente

**2027 — Maturidade**
- 3.4 Kanban
- 9.1 CI/CD + 9.3 Testes
- 10.1 PWA
- Decisao sobre 11.x (SaaS / multi-filial) conforme demanda comercial
