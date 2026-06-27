-- Metas de venda (por canal) e faturamento por cliente/mês — comparar com os realizados
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_vendas numeric;
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_vendas_trafego numeric;
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_vendas_loja numeric;
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_faturamento numeric;
