-- Vendas Loja (campo livre, não entra no cálculo) no Funil de Projeção
ALTER TABLE public.comparisons
  ADD COLUMN IF NOT EXISTS vendas_loja numeric;