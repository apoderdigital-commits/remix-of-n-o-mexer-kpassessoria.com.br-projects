
drop policy if exists "crm-audios read" on storage.objects;
create policy "crm-audios read"
  on storage.objects for select to authenticated, anon
  using (bucket_id = 'crm-audios');

drop policy if exists "crm-audios write" on storage.objects;
create policy "crm-audios write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'crm-audios');

drop policy if exists "crm-audios update" on storage.objects;
create policy "crm-audios update"
  on storage.objects for update to authenticated
  using (bucket_id = 'crm-audios');

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
  p_participant_name text default null,
  p_tipo text default 'texto',
  p_url_midia text default null
) returns uuid
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
  v_tipo text;
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
  v_tipo := lower(coalesce(nullif(p_tipo, ''), 'texto'));

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
      cliente_id, conversation_id, direcao, tipo, conteudo, url_midia, lida,
      remetente_nome, remetente_telefone, remetente_foto
    )
    values (
      v_cliente, v_conv, 'recebida', v_tipo, p_texto, nullif(p_url_midia, ''), false,
      nullif(coalesce(p_participant_name, case when p_is_group then p_nome end), ''),
      nullif(coalesce(p_participant_phone, case when p_is_group then p_phone end), ''),
      v_participant_photo
    )
    returning id into v_msg;

  return v_msg;
end;
$function$;

revoke all on function public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text, text, text) from public;
grant execute on function public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text, text, text) to anon, authenticated, service_role;

create or replace function public.crm_after_outgoing()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_phone text;
  v_conn  record;
begin
  if new.direcao <> 'enviada' then
    return new;
  end if;
  if coalesce(new.tipo, 'texto') not in ('texto', 'audio') then
    return new;
  end if;

  select ct.telefone into v_phone
    from public.crm_conversations cv
    join public.crm_contacts ct on ct.id = cv.contact_id
   where cv.id = new.conversation_id;
  if v_phone is null then return new; end if;

  select * into v_conn
    from public.crm_connections
   where cliente_id = new.cliente_id and provedor = 'z-api' and ativo
     and n8n_send_url is not null
   limit 1;
  if v_conn is null then return new; end if;

  begin
    perform net.http_post(
      url     := v_conn.n8n_send_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
                   'phone', v_phone,
                   'tipo', coalesce(new.tipo, 'texto'),
                   'message', new.conteudo,
                   'audio_url', new.url_midia,
                   'instance_id', v_conn.instance_id
                 )
    );
  exception when others then
    null;
  end;

  return new;
end;
$function$;
