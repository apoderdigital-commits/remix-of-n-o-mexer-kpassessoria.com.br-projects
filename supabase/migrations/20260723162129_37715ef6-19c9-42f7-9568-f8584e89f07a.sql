CREATE OR REPLACE FUNCTION public.crm_ingest_whatsapp(
  p_secret text,
  p_instance_id text,
  p_phone text,
  p_nome text DEFAULT NULL,
  p_texto text DEFAULT NULL,
  p_message_id text DEFAULT NULL,
  p_is_group boolean DEFAULT false,
  p_chat_id text DEFAULT NULL,
  p_photo text DEFAULT NULL,
  p_participant_phone text DEFAULT NULL,
  p_participant_name text DEFAULT NULL,
  p_tipo text DEFAULT 'texto',
  p_url_midia text DEFAULT NULL,
  p_sender_photo text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_cliente uuid;
  v_contact uuid;
  v_conv uuid;
  v_msg uuid;
  v_chat_id text;
  v_display_name text;
  v_display_phone text;
  v_group_photo text;
  v_participant_photo text;
  v_tipo text;
  v_url text;
  v_texto text;
begin
  v_chat_id := nullif(regexp_replace(coalesce(p_chat_id, p_phone, ''), '^=+', ''), '');
  v_display_phone := nullif(regexp_replace(coalesce(p_phone, v_chat_id, ''), '^=+', ''), '');

  if v_display_phone is null and v_chat_id is null then
    raise exception 'phone/chat_id vazio';
  end if;

  v_tipo := public.crm_sanitize_tipo(p_tipo);
  v_url := public.crm_sanitize_url(p_url_midia);
  v_texto := nullif(regexp_replace(coalesce(p_texto, ''), '^=+', ''), '');

  select cliente_id into v_cliente
  from public.crm_connections
  where instance_id = p_instance_id
    and webhook_secret = p_secret
    and ativo
  limit 1;

  if v_cliente is null then
    raise exception 'instancia nao mapeada ou segredo invalido';
  end if;

  v_chat_id := coalesce(v_chat_id, v_display_phone);
  v_display_phone := coalesce(v_display_phone, v_chat_id);
  v_display_name := nullif(regexp_replace(coalesce(p_nome, v_chat_id, v_display_phone, ''), '^=+', ''), '');
  v_display_name := coalesce(v_display_name, v_chat_id, v_display_phone);

  if coalesce(p_is_group, false) then
    v_group_photo := public.crm_sanitize_url(p_photo);
    v_participant_photo := public.crm_sanitize_url(p_sender_photo);
  else
    v_group_photo := public.crm_sanitize_url(p_photo);
    v_participant_photo := null;
  end if;

  -- Busca contato existente sem usar ON CONFLICT, pois os índices atuais são parciais.
  if v_chat_id is not null then
    select id into v_contact
    from public.crm_contacts
    where cliente_id = v_cliente
      and chat_id = v_chat_id
    limit 1;
  end if;

  if v_contact is null and v_display_phone is not null then
    select id into v_contact
    from public.crm_contacts
    where cliente_id = v_cliente
      and telefone = v_display_phone
      and (chat_id is null or chat_id = v_display_phone or chat_id = v_chat_id)
    limit 1;
  end if;

  if v_contact is null then
    insert into public.crm_contacts (cliente_id, nome, telefone, chat_id, is_group, foto_url)
    values (v_cliente, v_display_name, v_display_phone, v_chat_id, coalesce(p_is_group, false), v_group_photo)
    returning id into v_contact;
  else
    update public.crm_contacts
    set nome = case
          when coalesce(p_is_group, false) and v_display_name is not null then v_display_name
          else coalesce(public.crm_contacts.nome, v_display_name)
        end,
        telefone = coalesce(public.crm_contacts.telefone, v_display_phone),
        chat_id = coalesce(public.crm_contacts.chat_id, v_chat_id),
        is_group = coalesce(public.crm_contacts.is_group, false) or coalesce(p_is_group, false),
        foto_url = coalesce(v_group_photo, public.crm_contacts.foto_url)
    where id = v_contact;
  end if;

  select id into v_conv
  from public.crm_conversations
  where cliente_id = v_cliente
    and contact_id = v_contact
  order by criado_em
  limit 1;

  if v_conv is null then
    insert into public.crm_conversations (cliente_id, contact_id, status)
    values (v_cliente, v_contact, 'nao_lido')
    returning id into v_conv;
  end if;

  insert into public.crm_messages (
    cliente_id,
    conversation_id,
    direcao,
    tipo,
    conteudo,
    url_midia,
    lida,
    remetente_nome,
    remetente_telefone,
    remetente_foto
  ) values (
    v_cliente,
    v_conv,
    'recebida',
    v_tipo,
    v_texto,
    v_url,
    false,
    nullif(regexp_replace(coalesce(p_participant_name, case when p_is_group then p_nome end, ''), '^=+', ''), ''),
    nullif(regexp_replace(coalesce(p_participant_phone, case when p_is_group then p_phone end, ''), '^=+', ''), ''),
    case when coalesce(p_is_group, false) then v_participant_photo else null end
  )
  returning id into v_msg;

  update public.crm_conversations
  set status = 'nao_lido',
      ultima_mensagem = case when v_tipo = 'texto' then v_texto else '[' || v_tipo || ']' end,
      ultima_em = now(),
      atualizado_em = now()
  where id = v_conv;

  return v_msg;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text, text, text, text) TO service_role;