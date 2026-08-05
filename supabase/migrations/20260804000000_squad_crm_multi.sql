-- ============================================================================
-- Um cliente do Squad pode ter VÁRIOS clientes na dash de Criativos
-- Ex.: "Avelloz Ceara (Crato | Barbalha | Brejo Santo)" = 1 contrato, 3 contas
-- de anúncio. O vínculo 1-para-1 anterior não dava conta.
--
-- Escolhi array em vez de tabela de junção: são poucas dezenas de clientes,
-- o frontend lê e grava em uma única query, e não precisa de join.
-- Idempotente.
-- ============================================================================

alter table public.squad_clients
  add column if not exists crm_client_ids uuid[] not null default '{}';

comment on column public.squad_clients.crm_client_ids is
  'Clientes da dash de Criativos ligados a este cliente do Squad. Vazio = sem vínculo.';

-- Traz os vínculos que já existiam na coluna antiga (1-para-1).
update public.squad_clients
   set crm_client_ids = array[crm_client_id]
 where crm_client_id is not null
   and cardinality(crm_client_ids) = 0;

-- Busca por "quem está ligado a este cliente de Criativos".
create index if not exists squad_clients_crm_client_ids_idx
  on public.squad_clients using gin (crm_client_ids);

-- A coluna antiga fica como legado: não removo agora para não quebrar nada
-- que ainda a leia. Pode ser descartada depois de tudo migrado.
