-- Meta de vendas (quantidade, não valor) por canal, no cadastro do cliente
ALTER TABLE public.squad_clients
  ADD COLUMN IF NOT EXISTS meta_vendas_trafego integer,
  ADD COLUMN IF NOT EXISTS meta_vendas_loja integer;
