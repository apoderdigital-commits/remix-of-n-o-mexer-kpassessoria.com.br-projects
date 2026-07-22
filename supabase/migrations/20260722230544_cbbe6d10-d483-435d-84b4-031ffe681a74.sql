alter table public.squad_clients
  add column if not exists ticket_medio numeric;

alter table public.squad_engagement
  add column if not exists venda_secundaria numeric;