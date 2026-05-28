## Objetivo
A partir de agora, as métricas de **reuniões marcadas, comparecidas e no-show** (em todo o painel Comercial, para todos os SDRs/closers) vêm exclusivamente dos **appointments do calendário do GHL**, e não mais das etapas de pipeline. O filtro de quais calendários considerar continua igual (Configurações → Calendários).

## Mapeamento de status (calendário)
- `confirmed` → **Reunião marcada** (conta em "agendados")
- `showed` → **Compareceu** (conta em "realizados")
- `noshow` → **Não compareceu**
- `cancelled` → não entra em marcadas nem em comparecidas

Hoje o código incrementa `agendados++` para todo appointment (inclusive cancelados). Isso será corrigido: só entram em "marcadas" os com status `confirmed` ou `showed` ou `noshow` (ou seja, qualquer um que não seja cancelled/invalid). Cancelados ficam de fora das marcadas.

## Mudanças

### 1. Edge function `kp-comercial-snapshot`
- Forçar `meetings_source = "calendar"` (ignorar o valor salvo no banco).
- Ajustar o loop de appointments para que `agendados++` só rode quando o status for `confirmed`, `showed` ou `noshow` (excluindo `cancelled`/`invalid`).
- `realizados`/`noshow`/`cancelados` continuam como hoje.

### 2. Edge function `kp-comercial-fase2`
- Mesma correção do contador para alinhar com o snapshot (atualmente também faz `agendados++` indiscriminado).

### 3. UI — `src/pages/Comercial.tsx` (aba Config → Fontes de dados)
- Remover o seletor "Reuniões (marcadas/comparec./no-show): pipeline | calendar". A fonte passa a ser sempre **Calendário**, com um texto fixo explicando isso.
- Manter intacta a seção **Calendários** (lista com checkboxes por calendário, botão "Sincronizar calendários"), que é onde o usuário escolhe Matheus, Julio, Diego, Phillip etc.
- Manter o seletor de "Comparecidas (KPI): sheet | ghl" como está (é outro KPI).

### 4. Verificação
- Após deploy, abrir a página `/comercial` filtrando a semana de 24–30/05 com apenas os calendários "Calendário Matheus" e "Julio calendar" marcados e conferir se o total de marcadas bate com o print (~10 reuniões `confirmed` + as `showed`/`noshow` da semana).

## Fora do escopo
- Não mexer no fluxo de vendas/propostas (continuam vindo do pipeline).
- Não alterar a tabela `kp_comercial_calendars` nem o RPC de sincronização de calendários.
- Não mexer no `kp-comercial-fase3` (já lê do calendário).
