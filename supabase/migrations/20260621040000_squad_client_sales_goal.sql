-- Meta de venda (mensal) por cliente do squad
ALTER TABLE public.squad_clients ADD COLUMN IF NOT EXISTS sales_goal numeric;
