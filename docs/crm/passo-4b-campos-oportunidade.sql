-- ============================================================================
-- CRM · Ajuste 4b — campos extras na oportunidade
-- Adiciona item de compra, vendedor e observação em crm_opportunities.
-- Rode depois dos passos anteriores. Idempotente e seguro.
-- (O app já grava esses campos de forma resiliente; sem esta migração eles
--  simplesmente não persistem e o app avisa.)
-- ============================================================================

alter table public.crm_opportunities
  add column if not exists item_compra text,
  add column if not exists vendedor    text,
  add column if not exists observacao  text;
