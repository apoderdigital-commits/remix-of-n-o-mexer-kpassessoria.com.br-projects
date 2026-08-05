alter table public.squad_clients
  add column if not exists crm_client_ids uuid[] not null default '{}';

comment on column public.squad_clients.crm_client_ids is
  'Clientes da dash de Criativos ligados a este cliente do Squad. Vazio = sem vínculo.';

update public.squad_clients
   set crm_client_ids = array[crm_client_id]
 where crm_client_id is not null
   and cardinality(crm_client_ids) = 0;

create index if not exists squad_clients_crm_client_ids_idx
  on public.squad_clients using gin (crm_client_ids);