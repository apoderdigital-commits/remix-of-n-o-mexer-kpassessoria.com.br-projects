-- Metas de vendas por cliente/mês (comparar com os realizados: vendas, vendas_trafego)
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_vendas numeric;
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_vendas_trafego numeric;
