create table if not exists public.kp_comercial_metas_mes (
  competencia       date primary key,
  meta_faturamento  numeric(14,2) not null default 0,
  meta_vendas       integer       not null default 0,
  meta_mqls         integer       not null default 0,
  meta_leads        integer       not null default 0,
  considerar_dias_uteis boolean   not null default true,
  observacoes       text,
  atualizado_em     timestamptz   not null default now()
);

grant select, insert, update, delete on public.kp_comercial_metas_mes to authenticated;
grant all on public.kp_comercial_metas_mes to service_role;

alter table public.kp_comercial_metas_mes enable row level security;

drop policy if exists kp_metas_mes_leitura on public.kp_comercial_metas_mes;
create policy kp_metas_mes_leitura on public.kp_comercial_metas_mes
  for select to authenticated using (true);

drop policy if exists kp_metas_mes_escrita on public.kp_comercial_metas_mes;
create policy kp_metas_mes_escrita on public.kp_comercial_metas_mes
  for all to authenticated using (true) with check (true);