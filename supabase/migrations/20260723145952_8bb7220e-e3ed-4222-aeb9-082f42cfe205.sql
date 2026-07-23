-- 1) Colunas novas em crm_contacts
alter table public.crm_contacts
  add column if not exists foto_url text,
  add column if not exists is_group boolean not null default false,
  add column if not exists chat_id text;

-- Popula chat_id para contatos existentes (usa telefone)
update public.crm_contacts set chat_id = telefone where chat_id is null;

-- Índice único por (cliente_id, chat_id) — identifica conversa única (individual ou grupo)
create unique index if not exists uq_crm_contacts_cliente_chatid
  on public.crm_contacts (cliente_id, chat_id)
  where chat_id is not null;

-- 2) Colunas novas em crm_messages para preservar remetente em grupos
alter table public.crm_messages
  add column if not exists remetente_nome text,
  add column if not exists remetente_telefone text;

-- 3) Nova versão do RPC de ingestão (adiciona parâmetros opcionais)
drop function if exists public.crm_ingest_whatsapp(text, text, text, text, text, text);

create or replace function public.crm_ingest_whatsapp(
  p_secret text,
  p_instance_id text,
  p_phone text,
  p_nome text default null,
  p_texto text default null,
  p_message_id text default null,
  p_is_group boolean default false,
  p_chat_id text default null,
  p_photo text default null,
  p_participant_phone text default null,
  p_participant_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid;
  v_contact uuid;
  v_conv    uuid;
  v_msg     uuid;
  v_chat_id text;
  v_display_name text;
  v_display_phone text;
begin
  if coalesce(p_phone, '') = '' and coalesce(p_chat_id, '') = '' then
    raise exception 'phone/chat_id vazio';
  end if;

  select cliente_id into v_cliente
    from public.crm_connections
   where provedor = 'z-api'
     and instance_id = p_instance_id
     and ativo
     and webhook_secret is not null
     and webhook_secret = p_secret
   limit 1;
  if v_cliente is null then
    raise exception 'instancia nao mapeada ou segredo invalido';
  end if;

  -- chat_id identifica a conversa (grupo => id do grupo; individual => telefone)
  v_chat_id := coalesce(nullif(p_chat_id, ''), p_phone);
  v_display_name := coalesce(nullif(p_nome, ''), v_chat_id);
  v_display_phone := coalesce(nullif(p_phone, ''), v_chat_id);

  -- Busca por chat_id primeiro; se não achou, cai pra telefone (compat)
  select id into v_contact from public.crm_contacts
   where cliente_id = v_cliente and chat_id = v_chat_id limit 1;
  if v_contact is null then
    select id into v_contact from public.crm_contacts
     where cliente_id = v_cliente and telefone = v_display_phone and (chat_id is null or chat_id = v_display_phone)
     limit 1;
  end if;

  if v_contact is null then
    insert into public.crm_contacts (cliente_id, nome, telefone, chat_id, is_group, foto_url)
      values (v_cliente, v_display_name, v_display_phone, v_chat_id, coalesce(p_is_group, false), nullif(p_photo, ''))
      returning id into v_contact;
  else
    update public.crm_contacts
       set nome     = coalesce(nome, v_display_name),
           chat_id  = coalesce(chat_id, v_chat_id),
           is_group = coalesce(is_group, false) or coalesce(p_is_group, false),
           foto_url = coalesce(nullif(p_photo, ''), foto_url)
     where id = v_contact;
  end if;

  select id into v_conv from public.crm_conversations
   where contact_id = v_contact order by criado_em limit 1;
  if v_conv is null then
    insert into public.crm_conversations (cliente_id, contact_id, status)
      values (v_cliente, v_contact, 'nao_lido')
      returning id into v_conv;
  end if;

  insert into public.crm_messages (cliente_id, conversation_id, direcao, tipo, conteudo, lida, remetente_nome, remetente_telefone)
    values (
      v_cliente, v_conv, 'recebida', 'texto', p_texto, false,
      nullif(coalesce(p_participant_name, case when p_is_group then p_nome end), ''),
      nullif(coalesce(p_participant_phone, case when p_is_group then p_phone end), '')
    )
    returning id into v_msg;

  return v_msg;
end;
$$;

revoke all on function public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text) from public;
grant execute on function public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text) to anon, authenticated, service_role;