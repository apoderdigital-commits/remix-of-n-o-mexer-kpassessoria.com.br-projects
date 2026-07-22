alter table public.squad_clients
  add column if not exists strategy_file_url text,
  add column if not exists strategy_file_name text;