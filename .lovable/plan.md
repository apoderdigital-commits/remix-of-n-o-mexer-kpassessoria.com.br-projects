

## Dashboard de Performance de Criativos — Plano Atualizado

### Resumo

Dashboard multi-cliente com banco de dados Supabase, integração direta com a API da Meta Ads para puxar leads totais e investimento, e dados de leads qualificados (CPF aprovado / venda) recebidos via webhook do n8n.

---

### Arquitetura

```text
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Meta Ads   │────▸│  Edge Function   │────▸│   Supabase   │
│   API       │     │  (fetch-meta)    │     │   Database   │
└─────────────┘     └──────────────────┘     └──────┬───────┘
                                                     │
┌─────────────┐     ┌──────────────────┐             │
│  GHL / n8n  │────▸│  Edge Function   │─────────────┘
│  Webhook    │     │  (webhook-leads) │
└─────────────┘     └──────────────────┘
                                                     │
                    ┌──────────────────┐             │
                    │   Dashboard      │◂────────────┘
                    │   React App      │
                    └──────────────────┘
```

---

### 1. Banco de Dados (Supabase)

**Tabelas:**

- **clients** — id, name, meta_account_id, meta_access_token (encrypted), created_at
- **meta_campaigns** — id, client_id, campaign_name, ad_name (criativo), leads_total, amount_spent, date, synced_at
- **qualified_leads** — id, client_id, creative_name, status (enum: 'cpf_approved' | 'sale'), lead_date, received_at
- **user_roles** — id, user_id, role (enum: 'admin' | 'manager')

RLS habilitado em todas as tabelas. Acesso baseado em roles.

### 2. Edge Functions

**fetch-meta-data** — Chamada pela dashboard (ou cron) para buscar dados da API da Meta Ads:
- Recebe client_id, período
- Usa o token da Meta salvo no banco para buscar campanhas, criativos, leads e investimento
- Salva/atualiza na tabela `meta_campaigns`

**webhook-qualified-leads** — Endpoint público para o n8n:
- Recebe POST com: client_id, creative_name, status (cpf_approved/sale), date
- Valida com Zod e insere na tabela `qualified_leads`

### 3. Frontend — Dashboard

**Seletor de Cliente** — Dropdown no topo para escolher qual cliente visualizar

**Cards de Resumo (5 cards):**
1. Total de Leads (Meta Ads)
2. Investimento Total (Meta Ads)
3. CPFs Aprovados
4. Vendas Finalizadas
5. Custo por Lead Qualificado (investimento ÷ qualificados)

**Ranking de Criativos por CPF Aprovado** — Tabela com criativo, quantidade, % do total

**Ranking de Criativos por Venda** — Tabela com criativo, quantidade, % do total

**Gráfico de Evolução** — Linha temporal com leads totais vs qualificados

**Filtro por Período** — 7d, 15d, 30d, customizado

**Página de Gestão de Clientes** — CRUD para cadastrar clientes e seus tokens da Meta

### 4. Tema Visual
- Background escuro (#0f1729, #1a1f3a)
- Cards glassmorphism com bordas sutis
- Destaque roxo/violeta (#8B5CF6)
- Texto branco/cinza claro

---

### Pré-requisitos

1. **Ativar Lovable Cloud** (Supabase integrado) para criar o banco de dados
2. **Token da Meta Ads** — Cada cliente precisa de um token de acesso de longa duração da Meta (gerado no Business Manager)

### Etapas de Implementação

1. Criar tabelas e RLS no Supabase
2. Criar edge function do webhook (n8n)
3. Criar edge function para buscar dados da Meta Ads
4. Criar página de gestão de clientes
5. Criar dashboard principal com cards, rankings e gráficos
6. Aplicar tema visual

---

### Segurança
- Tokens da Meta armazenados como secrets no Supabase (não em texto plano)
- Webhook validado com Zod + chave de autenticação
- RLS em todas as tabelas
- Roles separados em tabela dedicada

