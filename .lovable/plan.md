

## Plan: Integração GoHighLevel (GHL) Pipeline na Dashboard

### Resumo
Integrar a API do GoHighLevel para puxar contagens de oportunidades por etapa da pipeline, exibindo na dashboard: Simulações, CPF Aprovado, CPF Não Aprovado, com indicadores de % (metas de 60%, 15%, 20%).

### O que será feito

**1. Adicionar campos GHL na tabela `clients`**
- Migração: adicionar `ghl_api_key` (text) e `ghl_location_id` (text) à tabela `clients`
- Atualizar o formulário de cadastro de clientes para incluir esses campos

**2. Criar Edge Function `fetch-ghl-pipeline`**
- Recebe `client_id` como parâmetro
- Busca `ghl_api_key` e `ghl_location_id` do cliente no banco
- Chama `GET https://services.leadconnectorhq.com/opportunities/pipelines` para listar pipelines/stages
- Chama `POST https://services.leadconnectorhq.com/opportunities/search` para contar oportunidades por stage
- Retorna contagens: simulações, cpf_aprovado, cpf_nao_aprovado

**3. Atualizar a Dashboard (StatsCards)**
- Adicionar novos cards: Simulações, CPF Aprovado (GHL), CPF Não Aprovado
- Adicionar indicadores visuais de % com metas:
  - Simulações / Leads Totais ≥ 60%
  - CPF Aprovado / Simulações ≥ 15%  
  - Vendas / CPF Aprovado ≥ 20%
- Verde se atingiu a meta, vermelho se não

**4. Configuração inicial de teste**
- Salvar a API key (`pit-8883ff43-...`) e location ID (`T6S5cO1s72adtbDovjdX`) no cliente "Shineray Porto Velho" para validar

### Detalhes técnicos

- **API GHL v2**: Base URL `https://services.leadconnectorhq.com`, autenticação via header `Authorization: Bearer {api_key}`, header `Version: 2021-07-28`
- A API key será armazenada no banco (campo da tabela clients), não como secret global, pois cada cliente tem sua própria key
- A edge function faz a chamada server-side para não expor a key
- Os nomes das stages serão mapeados por correspondência parcial (ex: "CPF Aprovado" → stage que contém "aprovado/qualificado")

### Arquivos afetados
- `supabase/migrations/` — nova migração (campos GHL)
- `supabase/functions/fetch-ghl-pipeline/index.ts` — nova edge function
- `src/hooks/useDashboardData.ts` — novo hook para dados GHL
- `src/components/dashboard/StatsCards.tsx` — novos cards + indicadores de %
- `src/pages/Clients.tsx` — campos GHL no formulário
- `src/pages/Criativos.tsx` — integrar dados GHL

