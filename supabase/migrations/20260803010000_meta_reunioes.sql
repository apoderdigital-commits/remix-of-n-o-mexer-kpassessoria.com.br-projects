-- ============================================================================
-- Painel Comercial — meta de reuniões comparecidas
-- "Comparecidas" = a reunião aconteceu de fato (o lead apareceu), diferente
-- de agendadas. No painel isso vem de mqlSummary.realizados.
-- Rode depois de kp_comercial_metas_mes. Idempotente.
-- ============================================================================

alter table public.kp_comercial_metas_mes
  add column if not exists meta_reunioes integer not null default 0;

comment on column public.kp_comercial_metas_mes.meta_reunioes is
  'Meta de reuniões que aconteceram (compareceram), não de agendadas.';
