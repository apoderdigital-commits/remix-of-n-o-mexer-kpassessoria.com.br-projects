ALTER TABLE public.squad_engagement
  ADD COLUMN IF NOT EXISTS vendas_trafego numeric,
  ADD COLUMN IF NOT EXISTS vendas_loja numeric;