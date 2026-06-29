-- Uso do CRM por cliente (nota 1-5) na aba Engajamento do squad
ALTER TABLE public.squad_engagement
  ADD COLUMN IF NOT EXISTS crm_usage smallint;
