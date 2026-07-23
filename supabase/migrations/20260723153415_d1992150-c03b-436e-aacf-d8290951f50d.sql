create or replace function public.crm_ingest_whatsapp(p_secret text, p_instance_id text, p_phone text, p_nome text default null::text, p_texto text default null::text, p_message_id text default null::text, p_is_group boolean default false, p_chat_id text default null::text, p_photo text default null::text, p_participant_phone text default null::text, p_participant_name text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cliente uuid;
  v_contact uuid;
  v_conv    uuid;
  v_msg     uuid;
  v_chat_id text;
  v_display_name text;
  v_display_phone text;
  v_group_photo text;
  v_participant_photo text;
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

  v_chat_id       := coalesce(nullif(p_chat_id, ''), p_phone);
  v_display_name  := coalesce(nullif(p_nome, ''), v_chat_id);
  v_display_phone := coalesce(nullif(p_phone, ''), v_chat_id);

  if coalesce(p_is_group, false) then
    v_group_photo := null;
    v_participant_photo := nullif(p_photo, '');
  else
    v_group_photo := nullif(p_photo, '');
    v_participant_photo := null;
  end if;

  select id into v_contact from public.crm_contacts
   where cliente_id = v_cliente and chat_id = v_chat_id limit 1;
  if v_contact is null then
    select id into v_contact from public.crm_contacts
     where cliente_id = v_cliente and telefone = v_display_phone and (chat_id is null or chat_id = v_display_phone)
     limit 1;
  end if;

  if v_contact is null then
    insert into public.crm_contacts (cliente_id, nome, telefone, chat_id, is_group, foto_url)
      values (v_cliente, v_display_name, v_display_phone, v_chat_id, coalesce(p_is_group, false), v_group_photo)
      returning id into v_contact;
  else
    -- Para GRUPOS: sempre atualiza o nome com o mais recente (p_nome = chatName do webhook).
    -- Para contato individual: mantém o nome já salvo se existir (não sobrescreve).
    update public.crm_contacts
       set nome     = case
                        when coalesce(p_is_group, false) and nullif(p_nome, '') is not null then p_nome
                        else coalesce(nome, v_display_name)
                      end,
           chat_id  = coalesce(chat_id, v_chat_id),
           is_group = coalesce(is_group, false) or coalesce(p_is_group, false),
           foto_url = case when coalesce(p_is_group, false) then foto_url
                           else coalesce(v_group_photo, foto_url) end
     where id = v_contact;
  end if;

  select id into v_conv from public.crm_conversations
   where contact_id = v_contact order by criado_em limit 1;
  if v_conv is null then
    insert into public.crm_conversations (cliente_id, contact_id, status)
      values (v_cliente, v_contact, 'nao_lido')
      returning id into v_conv;
  end if;

  insert into public.crm_messages (
      cliente_id, conversation_id, direcao, tipo, conteudo, lida,
      remetente_nome, remetente_telefone, remetente_foto
    )
    values (
      v_cliente, v_conv, 'recebida', 'texto', p_texto, false,
      nullif(coalesce(p_participant_name, case when p_is_group then p_nome end), ''),
      nullif(coalesce(p_participant_phone, case when p_is_group then p_phone end), ''),
      v_participant_photo
    )
    returning id into v_msg;

  return v_msg;
end;
$function$;