-- ============================================================================
-- CRM · Passo 5 — telefone único por loja (evita contato duplicado)
-- Cria o índice único (cliente_id, telefone) que a tela de Contatos usa para
-- barrar telefone repetido com mensagem amigável.
-- Índice PARCIAL: só vale para telefone preenchido — vários contatos podem
-- ficar sem telefone sem conflitar.
-- Idempotente. Obs: se já existirem 2 contatos com o MESMO telefone na mesma
-- loja, limpe o duplicado antes de rodar (senão a criação do índice falha).
-- ============================================================================

create unique index if not exists uq_crm_contacts_cliente_telefone
  on public.crm_contacts (cliente_id, telefone)
  where telefone is not null;