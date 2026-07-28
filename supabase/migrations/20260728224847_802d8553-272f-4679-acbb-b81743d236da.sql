alter table public.squad_clients
  add column if not exists crm_client_id uuid references public.clients(id) on delete set null;

create index if not exists squad_clients_crm_client_id_idx
  on public.squad_clients (crm_client_id);