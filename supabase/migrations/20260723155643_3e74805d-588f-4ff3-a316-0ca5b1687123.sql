-- Corrige diferenciação entre foto do grupo (chat) e foto do participante (remetente).
-- Ao entrar em grupo, p_photo agora é tratado como foto do grupo (chat) e p_sender_photo (novo) como foto do participante.
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
    -- em grupo: p_photo = foto do grupo (chat), p_sender_photo = foto do participante
    v_group_photo := nullif(p_photo, '');
    v_participant_photo := nullif(p_sender_photo, '');
  else
    -- 1:1: p_photo = foto do contato
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
           foto_url = coalesce(v_group_photo, foto_url)
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

-- Limpa fotos de remetente incorretas (que na verdade eram fotos do grupo)
-- em mensagens já existentes de conversas de grupo.
UPDATE public.crm_messages m
   SET remetente_foto = NULL
  FROM public.crm_conversations c
  JOIN public.crm_contacts k ON k.id = c.contact_id
 WHERE m.conversation_id = c.id
   AND k.is_group = true
   AND m.remetente_foto IS NOT NULL;