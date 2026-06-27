ALTER TABLE public.squad_clients ADD COLUMN IF NOT EXISTS sales_goal numeric;

ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_vendas numeric;
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_vendas_trafego numeric;
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_vendas_loja numeric;
ALTER TABLE public.squad_engagement ADD COLUMN IF NOT EXISTS meta_faturamento numeric;