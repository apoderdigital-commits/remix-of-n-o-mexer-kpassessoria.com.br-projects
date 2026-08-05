-- ============================================================================
-- Painel Comercial — meta do mês, para medir o RITMO
-- Uma linha por competência (primeiro dia do mês). Serve para comparar
-- "como deveria estar até hoje" com "como está".
-- Idempotente.
-- ============================================================================

create table if not exists public.kp_comercial_metas_mes (
  competencia       date primary key,
  meta_faturamento  numeric(14,2) not null default 0,
  meta_vendas       integer       not null default 0,
  meta_mqls         integer       not null default 0,
  meta_leads        integer       not null default 0,
  -- Dias em que a equipe realmente trabalha. O ritmo esperado é proporcional
  -- aos dias úteis decorridos, não aos dias corridos: senão todo fim de semana
  -- a meta parece atrasada sem ninguém ter falhado.
  considerar_dias_uteis boolean   not null default true,
  observacoes       text,
  atualizado_em     timestamptz   not null default now()
);

alter table public.kp_comercial_metas_mes enable row level security;

-- Mesma regra das outras tabelas do painel comercial: quem entra no app vê.
drop policy if exists kp_metas_mes_leitura on public.kp_comercial_metas_mes;
create policy kp_metas_mes_leitura on public.kp_comercial_metas_mes
  for select to authenticated using (true);

drop policy if exists kp_metas_mes_escrita on public.kp_comercial_metas_mes;
create policy kp_metas_mes_escrita on public.kp_comercial_metas_mes
  for all to authenticated using (true) with check (true);
