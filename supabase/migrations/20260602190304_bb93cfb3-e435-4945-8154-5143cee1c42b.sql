ALTER TABLE public.squad_engagement
  ADD COLUMN IF NOT EXISTS meta_status text,
  ADD COLUMN IF NOT EXISTS vendas numeric,
  ADD COLUMN IF NOT EXISTS vendas_por_canais text,
  ADD COLUMN IF NOT EXISTS vendas_perc_canais text,
  ADD COLUMN IF NOT EXISTS faturamento numeric,
  ADD COLUMN IF NOT EXISTS faturamento_por_canais text,
  ADD COLUMN IF NOT EXISTS faturamento_perc_canais text;