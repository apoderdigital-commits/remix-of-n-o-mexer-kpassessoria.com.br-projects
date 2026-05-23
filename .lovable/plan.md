## Objetivo

Tornar o Painel Comercial 100% configurável: você define **de qual pipeline/stage** vem cada métrica e **qual fonte** (Planilha · Meta · GHL) alimenta cada card. Os "500 leads irreais" somem porque os leads passam a vir da planilha.

---

## 1. Banco — 2 tabelas novas

**`comercial_pipeline_config`** (singleton por workspace, sem `client_id`)
- `role` (`sdr` | `closer`) — pipeline pode ser diferente por função
- `pipeline_id` (texto, GHL)
- `stages_reuniao_marcada` (text[])
- `stages_comparecida` (text[])
- `stages_proposta_enviada` (text[])
- `stages_proposta_perdida` (text[])
- `stages_vendida` (text[])
- `stages_noshow` (text[])

**`comercial_data_sources`** (singleton)
- `leads_source` (`sheet` | `ghl`) — default `sheet`
- `mqls_source` (`sheet` | `ghl`) — default `sheet`
- `reunioes_source` (`ghl`) — fixo GHL (sem opção)
- `comparecidas_source` (`ghl` | `sheet`)
- `vendas_source` (`ghl` | `sheet`)
- `sheet_id` (texto, default = planilha KP UTM RASTREIO)
- `sheet_tab` (texto, default `Página4`)
- `sheet_mql_column` (texto, default `MQL`)
- `sheet_mql_value` (texto, default `SIM`)

RLS: leitura/escrita só para admin/manager.

---

## 2. Aba Config — UI nova

Reorganizada em 3 seções (substitui a atual "Funções da equipe"):

### 2.1 Funções da equipe (mantém o que já existe)

### 2.2 Pipelines & Stages
Para cada função (**SDR** / **Closer**):
- Dropdown "Pipeline" (lista vinda de `list-ghl-stages`)
- Para cada métrica (Reunião marcada, Comparecida, Proposta enviada, Proposta perdida, Vendida, No-show) → chips multi-select de stages daquele pipeline (reusa o padrão visual de `GhlStageMappingEditor`)

### 2.3 Fontes de dados
Tabela com uma linha por métrica e radios de fonte:

```text
Métrica              Planilha   Meta Ads   GHL
Leads totais            ( )        —       ( )
MQLs                    ( )        —       ( )
Taxa Ativação MQL    (calculada — não tem fonte)
Reuniões marcadas       —          —       (●)  (fixo)
Comparecidas            ( )        —       ( )
Vendas                  ( )        —       ( )
Investimento            —         (●)       —   (fixo)
```

Campos extras: Sheet ID · Aba · Coluna MQL · Valor MQL=positivo.

---

## 3. Cards do funil — seletor de fonte inline

Cada card de KPI ganha um pequeno ícone `⋯` no canto que abre um popover com:
- Fonte atual (badge: "via Planilha" / "via GHL" / "via Meta")
- Botão "Trocar fonte" → atualiza `comercial_data_sources` e re-fetch
Igual ao padrão do dashboard de Criativos.

---

## 4. Edge function `kp-comercial-snapshot` — refatoração

Nova ordem:
1. Lê `comercial_data_sources` + `comercial_pipeline_config`
2. **Leads/MQLs**:
   - Se `source=sheet`: faz fetch CSV de `https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={tab}`, filtra por data, conta linhas (leads) e linhas com coluna MQL=SIM (mqls)
   - Se `source=ghl`: comportamento atual
3. **Reuniões / Comparecidas / Vendas**:
   - Busca opportunities **apenas** no `pipeline_id` configurado para a função
   - Usa stages mapeadas em vez de regex no nome
4. **Propostas (Closer)**:
   - "Em aberto" = opps em `stages_proposta_enviada`
   - "Perdida" = opps em `stages_proposta_perdida`
5. **No-show**: usa `stages_noshow` mapeadas

---

## 5. Frontend `src/pages/Comercial.tsx`

- Hook `useComercialConfig` (load + mutate)
- Aba Config: 3 sub-seções acordeonáveis
- Função `<DataSourcePopover metric="leads">` reutilizável nos cards
- Badge "via Planilha" / "via GHL" abaixo do número em cada card

---

## 6. Migração de dados

Cria registros default em ambas as tabelas:
- `comercial_data_sources`: tudo `sheet` por default (você pediu deixar o usuário escolher; default razoável é planilha já que GHL infla)
- `comercial_pipeline_config`: vazio — você preenche na primeira visita à Config

Banner amarelo no topo da página se a config estiver incompleta: "⚠️ Configure pipelines em Config para ver dados reais."

---

## Detalhes técnicos

- Sheet fetch via CSV export público (já usado em `sync-google-sheet`); reusa parser de CSV
- Stages do GHL listados via `list-ghl-stages` edge function existente
- Tipo `Database` será regenerado após a migração
- Sem mudanças em RLS de outras tabelas

---

## Ordem de implementação

1. Migration (2 tabelas + RLS + defaults)
2. Refator do edge function
3. Aba Config nova (3 seções)
4. Popover de fonte nos cards
5. Banner de "config incompleta"