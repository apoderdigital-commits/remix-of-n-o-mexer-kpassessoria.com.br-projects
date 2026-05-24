# Reuniões do GHL Calendar por SDR, filtradas por fonte = METAADS

## Objetivo
Puxar appointments do GHL Calendar, manter só os de contatos com oportunidade `source = METAADS`, e agregar as métricas (marcadas / confirmadas / comparecidas / no-show / canceladas) **por SDR** — usando o `assignedTo` da oportunidade como dono da reunião.

## Regra de atribuição (importante)
Para cada appointment:
1. Buscar oportunidades do `contactId`.
2. Filtrar pelas que têm `source ≈ METAADS`.
3. Da oportunidade resultante, ler `assignedTo` → esse é o **SDR** da reunião.
4. Se houver várias opps METAADS pro mesmo contato: pegar a mais recente (`updatedAt` desc).
5. Se a opp não tiver `assignedTo`: fallback pro `assignedUserId` do appointment (dono do calendário).
6. Mapear `ghl_user_id → role (SDR/Closer/Gestor)` via `kp_comercial_user_roles` (já existe). Só conta como reunião de SDR quando role = SDR; do contrário rotula como "Closer" ou "Outros".

## Endpoints GHL
- `GET /calendars/?locationId=...` — lista calendários
- `GET /calendars/events?locationId=...&calendarId=...&startTime=...&endTime=...` — appointments + status + `assignedUserId` + `contactId`
- `GET /opportunities/search?location_id=...&contact_id=...` — opps do contato → `source` + `assignedTo` + `updatedAt`
- `GET /users/?locationId=...` — nome/email dos usuários (já cacheado em `kp_comercial_user_roles`)

## Mudanças

### 1. Banco
- Nova tabela `kp_comercial_calendars`:
  ```
  ghl_calendar_id text PK, name text, enabled boolean default false, updated_at timestamptz
  ```
  (Sem `ghl_user_id` fixo — o dono real vem da oportunidade, não do calendário.)
- Adicionar em `kp_comercial_data_sources`: `opportunity_source_filter text default 'METAADS'`, `meetings_source text default 'pipeline'` (`pipeline` | `calendar`).

### 2. Edge function nova `kp-comercial-meetings`
Entrada: `{ since, until }`. Saída:
```jsonc
{
  totals: { marcadas, confirmadas, comparecidas, noshow, canceladas },
  by_sdr: [
    { ghl_user_id, name, role, marcadas, confirmadas, comparecidas, noshow, canceladas }
  ],
  debug: { appointments_brutos, filtrados_por_source, sem_opp, top_sources }
}
```
Algoritmo:
- Lista appointments de **todos os calendários `enabled`** no período.
- Pré-carrega opps do período (`/opportunities/search` paginado, todas pipelines) → `Map<contactId, opps[]>` para evitar 1 chamada por contato.
- Para cada appointment: encontra opp METAADS mais recente do contato → extrai `assignedTo` → incrementa contador do SDR.

### 3. UI `Comercial.tsx`
- Seção **Calendários do GHL**: botão "Sincronizar" + lista com switch on/off por calendário.
- Toggle de fonte nos cards de reunião: **Pipeline** ↔ **Calendário** (igual ao de leads).
- Novo bloco **Reuniões por SDR** (tabela): nome do SDR, marcadas, confirmadas, comparecidas, no-show, taxa de comparecimento. Linha extra "Closer/Outros" agrupando o que não é SDR.

### 4. Integração no snapshot
`kp-comercial-snapshot` chama `kp-comercial-meetings` quando `meetings_source = 'calendar'` e grava `by_sdr` no payload — os blocos existentes de SDR ranking passam a ler dali quando essa fonte estiver ativa.

## Validação
- Sincronizar → calendários da subconta aparecem; ativar Matheus + Julio.
- Rodar snapshot da semana 18–24/05.
- Conferir: soma de `marcadas` por SDR = `totals.marcadas`.
- Spot-check: pegar 3 appointments na UI do GHL, abrir o contato → opp → ver se o SDR atribuído bate com o que aparece na tabela.

## Fora de escopo
- Pipelines de etapas (já configurado em `kp_comercial_pipeline_config`).
- Leads/MQLs da planilha (plano separado).
