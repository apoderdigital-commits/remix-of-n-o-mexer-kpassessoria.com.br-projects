-- Fechamento Operacional: campos preenchidos manualmente por cliente/mês.
-- Ficam em squad_engagement porque o fechamento é POR MÊS (mesma chave: squad_id + client_name + reference_month).
ALTER TABLE public.squad_engagement
  ADD COLUMN IF NOT EXISTS plano_estrategico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plano_estrategico_link text,
  ADD COLUMN IF NOT EXISTS conversao_comercial numeric;