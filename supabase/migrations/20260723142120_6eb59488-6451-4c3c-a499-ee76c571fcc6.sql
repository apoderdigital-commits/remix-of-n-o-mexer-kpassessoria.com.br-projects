-- ============================================================================
-- CRM · Passo 6 — Ingestão de WhatsApp (n8n + Z-API)
-- Cria:
--   1) crm_connections  — mapeia a instância do provedor (Z-API) -> loja (cliente)
--   2) crm_ingest_whatsapp() — RPC chamada pelo n8n (com a service_role key) que
--      recebe a mensagem, garante contato + conversa e insere em crm_messages.
-- Pré-requisitos: passos 1 e 3. Idempotente.
-- ============================================================================

-- 1) Mapa instância -> loja --------------------------------------------------
create table if not exists public.crm_connections (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.crm_clients(id) on delete cascade,
  provedor    text not null default 'z-api',
  instance_id text not null,
  numero      text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (provedor, instance_id)
);

alter table public.crm_connections enable row level security;
drop policy if exists crm_connections_rls on public.crm_connections;
create policy crm_connections_rls on public.crm_connections
  for all to authenticated
  using      (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin())
  with check (cliente_id = public.crm_current_cliente_id() or public.crm_is_admin());

-- 2) RPC de ingestão (chamada pelo n8n) --------------------------------------
create or replace function public.crm_ingest_whatsapp(
  p_instance_id text,
  p_phone       text,
  p_nome        text default null,
  p_texto       text default null,
  p_message_id  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid;
  v_contact uuid;
  v_conv    uuid;
  v_msg     uuid;
begin
  if coalesce(p_phone, '') = '' then
    raise exception 'phone vazio';
  end if;

  -- loja dona da instância
  select cliente_id into v_cliente
    from public.crm_connections
   where provedor = 'z-api' and instance_id = p_instance_id and ativo
   limit 1;
  if v_cliente is null then
    raise exception 'Instancia % nao mapeada em crm_connections', p_instance_id;
  end if;

  -- contato (get-or-create por telefone)
  select id into v_contact from public.crm_contacts
   where cliente_id = v_cliente and telefone = p_phone limit 1;
  if v_contact is null then
    insert into public.crm_contacts (cliente_id, nome, telefone)
      values (v_cliente, nullif(p_nome, ''), p_phone)
      returning id into v_contact;
  elsif nullif(p_nome, '') is not null then
    update public.crm_contacts set nome = coalesce(nome, p_nome) where id = v_contact;
  end if;

  -- conversa (get-or-create por contato)
  select id into v_conv from public.crm_conversations
   where contact_id = v_contact order by criado_em limit 1;
  if v_conv is null then
    insert into public.crm_conversations (cliente_id, contact_id, status)
      values (v_cliente, v_contact, 'nao_lido')
      returning id into v_conv;
  end if;

  -- mensagem recebida (o trigger da conversa atualiza preview/horario/status)
  insert into public.crm_messages (cliente_id, conversation_id, direcao, tipo, conteudo, lida)
    values (v_cliente, v_conv, 'recebida', 'texto', p_texto, false)
    returning id into v_msg;

  return v_msg;
end;
$$;

-- Só a service_role (usada pelo n8n) pode chamar. NÃO conceder a anon/authenticated
-- (a anon key é pública no front — não pode injetar mensagens).
revoke all on function public.crm_ingest_whatsapp(text, text, text, text, text) from public;
grant execute on function public.crm_ingest_whatsapp(text, text, text, text, text) to service_role;