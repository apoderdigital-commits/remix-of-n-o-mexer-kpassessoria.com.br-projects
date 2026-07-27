-- ============================================================================
-- Criativos · Sair do Google Sheets
-- O n8n passa a gravar direto em qualified_leads (o Sheets era só intermediário).
-- 1) Guarda de onde veio cada linha, pra "Sincronizar planilha" NUNCA apagar
--    o que o n8n registrou (o sync apaga e reinsere o período que ele importa).
-- 2) Guarda o nome do lead (usado pra deduplicar, como a planilha fazia) e o
--    ID do criativo (ID_CRIATIVO, que hoje só existia na planilha).
-- Idempotente.
-- ============================================================================

alter table public.qualified_leads add column if not exists source       text;
alter table public.qualified_leads add column if not exists lead_name    text;
alter table public.qualified_leads add column if not exists creative_id  text;

-- Tudo que já existe veio da planilha.
update public.qualified_leads set source = 'sheet' where source is null;

alter table public.qualified_leads alter column source set default 'sheet';

-- Dedup por pessoa + evento (mesma regra da planilha) e busca por origem.
create index if not exists qualified_leads_dedup_idx
  on public.qualified_leads (client_id, status, lower(lead_name));

create index if not exists qualified_leads_source_idx
  on public.qualified_leads (client_id, source);
