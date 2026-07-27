alter table public.qualified_leads add column if not exists source       text;
alter table public.qualified_leads add column if not exists lead_name    text;
alter table public.qualified_leads add column if not exists creative_id  text;

update public.qualified_leads set source = 'sheet' where source is null;

alter table public.qualified_leads alter column source set default 'sheet';

create index if not exists qualified_leads_dedup_idx
  on public.qualified_leads (client_id, status, lower(lead_name));

create index if not exists qualified_leads_source_idx
  on public.qualified_leads (client_id, source);