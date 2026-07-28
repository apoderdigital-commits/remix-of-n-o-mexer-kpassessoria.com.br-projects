-- ============================================================================
-- Vínculo entre o cliente do Squad e o cliente da dash de Criativos
-- Os dois cadastros são independentes: `squad_clients` tem TODOS os clientes,
-- `clients` (Criativos) tem só os que rodam tráfego. Casar por nome falha
-- (nomes como "Moto Mil Ariquemes | Porto | Vilhena" x "Moto Mil Ariquemes"),
-- então o vínculo passa a ser explícito, feito na tela de Mapeamento.
-- on delete set null: se o cliente de Criativos for removido, o do Squad
-- continua existindo, apenas sem vínculo.
-- Idempotente.
-- ============================================================================

alter table public.squad_clients
  add column if not exists crm_client_id uuid references public.clients(id) on delete set null;

create index if not exists squad_clients_crm_client_id_idx
  on public.squad_clients (crm_client_id);
