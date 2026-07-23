create extension if not exists pgcrypto;

create table if not exists public.crm_clients (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cidade     text,
  criado_em  timestamptz not null default now()
);

create table if not exists public.crm_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  nome          text not null,
  email         text,
  cliente_id    uuid not null references public.crm_clients(id) on delete cascade,
  papel         text not null default 'atendente'
                  check (papel in ('admin','atendente','gestor')),
  criado_em     timestamptz not null default now()
);
create index if not exists idx_crm_users_cliente on public.crm_users(cliente_id);
create index if not exists idx_crm_users_auth    on public.crm_users(auth_user_id);

create table if not exists public.crm_contacts (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.crm_clients(id) on delete cascade,
  nome       text,
  telefone   text,
  email      text,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_crm_contacts_cliente on public.crm_contacts(cliente_id);

create table if not exists public.crm_conversations (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.crm_clients(id) on delete cascade,
  contact_id    uuid not null references public.crm_contacts(id) on delete cascade,
  status        text not null default 'nao_lido'
                  check (status in ('nao_lido','lido','arquivado')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_crm_conversations_cliente on public.crm_conversations(cliente_id);
create index if not exists idx_crm_conversations_contact on public.crm_conversations(contact_id);

create table if not exists public.crm_messages (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.crm_clients(id) on delete cascade,
  conversation_id uuid not null references public.crm_conversations(id) on delete cascade,
  direcao         text not null check (direcao in ('recebida','enviada')),
  tipo            text not null default 'texto'
                    check (tipo in ('texto','audio','imagem','video')),
  conteudo        text,
  url_midia       text,
  lida            boolean not null default false,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_crm_messages_conversation on public.crm_messages(conversation_id);
create index if not exists idx_crm_messages_cliente      on public.crm_messages(cliente_id);

create table if not exists public.crm_pipelines (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.crm_clients(id) on delete cascade,
  nome       text not null,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_crm_pipelines_cliente on public.crm_pipelines(cliente_id);

create table if not exists public.crm_pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.crm_clients(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  nome        text not null,
  ordem       integer not null default 0
);
create index if not exists idx_crm_stages_pipeline on public.crm_pipeline_stages(pipeline_id);
create index if not exists idx_crm_stages_cliente  on public.crm_pipeline_stages(cliente_id);

create table if not exists public.crm_opportunities (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.crm_clients(id) on delete cascade,
  contact_id        uuid not null references public.crm_contacts(id) on delete cascade,
  pipeline_stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  valor             numeric,
  status            text not null default 'aberto'
                      check (status in ('aberto','ganho','perdido')),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists idx_crm_opps_cliente on public.crm_opportunities(cliente_id);
create index if not exists idx_crm_opps_contact on public.crm_opportunities(contact_id);
create index if not exists idx_crm_opps_stage   on public.crm_opportunities(pipeline_stage_id);

-- GRANTs (obrigatório para o Data API funcionar)
grant select, insert, update, delete on public.crm_clients         to authenticated;
grant select, insert, update, delete on public.crm_users           to authenticated;
grant select, insert, update, delete on public.crm_contacts        to authenticated;
grant select, insert, update, delete on public.crm_conversations   to authenticated;
grant select, insert, update, delete on public.crm_messages        to authenticated;
grant select, insert, update, delete on public.crm_pipelines       to authenticated;
grant select, insert, update, delete on public.crm_pipeline_stages to authenticated;
grant select, insert, update, delete on public.crm_opportunities   to authenticated;
grant all on public.crm_clients, public.crm_users, public.crm_contacts, public.crm_conversations, public.crm_messages, public.crm_pipelines, public.crm_pipeline_stages, public.crm_opportunities to service_role;

create or replace function public.crm_current_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cliente_id
  from public.crm_users
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.crm_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_users
    where auth_user_id = auth.uid() and papel = 'admin'
  );
$$;

alter table public.crm_clients         enable row level security;
alter table public.crm_users           enable row level security;
alter table public.crm_contacts        enable row level security;
alter table public.crm_conversations   enable row level security;
alter table public.crm_messages        enable row level security;
alter table public.crm_pipelines       enable row level security;
alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_opportunities   enable row level security;

drop policy if exists crm_clients_rls on public.crm_clients;
create policy crm_clients_rls on public.crm_clients
  for all to authenticated
  using      (id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (id = public.crm_current_cliente_id() or public.crm_is_admin());

drop policy if exists crm_users_rls on public.crm_users;
create policy crm_users_rls on public.crm_users
  for all to authenticated
  using      (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin());

drop policy if exists crm_contacts_rls on public.crm_contacts;
create policy crm_contacts_rls on public.crm_contacts
  for all to authenticated
  using      (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin());

drop policy if exists crm_conversations_rls on public.crm_conversations;
create policy crm_conversations_rls on public.crm_conversations
  for all to authenticated
  using      (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin());

drop policy if exists crm_messages_rls on public.crm_messages;
create policy crm_messages_rls on public.crm_messages
  for all to authenticated
  using      (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin());

drop policy if exists crm_pipelines_rls on public.crm_pipelines;
create policy crm_pipelines_rls on public.crm_pipelines
  for all to authenticated
  using      (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin());

drop policy if exists crm_pipeline_stages_rls on public.crm_pipeline_stages;
create policy crm_pipeline_stages_rls on public.crm_pipeline_stages
  for all to authenticated
  using      (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin());

drop policy if exists crm_opportunities_rls on public.crm_opportunities;
create policy crm_opportunities_rls on public.crm_opportunities
  for all to authenticated
  using      (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin());

create or replace function public.crm_touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_crm_conversations_touch on public.crm_conversations;
create trigger trg_crm_conversations_touch
  before update on public.crm_conversations
  for each row execute function public.crm_touch_updated();

drop trigger if exists trg_crm_opportunities_touch on public.crm_opportunities;
create trigger trg_crm_opportunities_touch
  before update on public.crm_opportunities
  for each row execute function public.crm_touch_updated();