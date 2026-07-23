CREATE OR REPLACE FUNCTION public.crm_sanitize_tipo(p_tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(regexp_replace(coalesce(p_tipo,'texto'), '^=+', '')) IN ('audio','texto','imagem','video','documento') 
      THEN lower(regexp_replace(coalesce(p_tipo,'texto'), '^=+', ''))
    ELSE 'texto'
  END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sanitize_url(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(coalesce(p_url,''), '^=+', ''), '');
$$;

-- Wrap the ingest function to sanitize inputs at entry (leading '=' from n8n fixed-mode expressions)
CREATE OR REPLACE FUNCTION public.crm_ingest_whatsapp(
  p_secret text, p_instance_id text, p_phone text,
  p_nome text DEFAULT NULL, p_texto text DEFAULT NULL,
  p_message_id text DEFAULT NULL, p_is_group boolean DEFAULT false,
  p_chat_id text DEFAULT NULL, p_photo text DEFAULT NULL,
  p_participant_phone text DEFAULT NULL, p_participant_name text DEFAULT NULL,
  p_tipo text DEFAULT 'texto', p_url_midia text DEFAULT NULL,
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
  v_url text;
  v_texto text;
begin
  -- Sanitize inputs (strip leading '=' if n8n sent expressions as literals)
  v_tipo := public.crm_sanitize_tipo(p_tipo);
  v_url  := public.crm_sanitize_url(p_url_midia);
  v_texto := NULLIF(regexp_replace(coalesce(p_texto,''), '^=+', ''), '');

  -- Validate webhook secret
  if p_secret is null or p_secret = '' then
    raise exception 'missing secret';
  end if;

  select cliente_id into v_cliente
  from public.crm_connections
  where instance_id = p_instance_id
    and webhook_secret = p_secret
  limit 1;

  if v_cliente is null then
    raise exception 'invalid secret or instance';
  end if;

  if p_is_group then
    v_chat_id := coalesce(p_chat_id, p_phone);
    v_display_phone := v_chat_id;
    v_display_name := coalesce(p_nome, v_chat_id);
    v_group_photo := p_photo;
    v_participant_photo := p_sender_photo;
  else
    v_display_phone := p_phone;
    v_display_name := coalesce(p_nome, p_phone);
    v_group_photo := p_photo;
    v_participant_photo := null;
  end if;

  insert into public.crm_contacts (cliente_id, telefone, nome, foto_url, is_group)
  values (v_cliente, v_display_phone, v_display_name, v_group_photo, coalesce(p_is_group,false))
  on conflict (cliente_id, telefone) do update
    set nome = case when excluded.is_group then excluded.nome else public.crm_contacts.nome end,
        foto_url = coalesce(excluded.foto_url, public.crm_contacts.foto_url),
        is_group = excluded.is_group
  returning id into v_contact;

  insert into public.crm_conversations (cliente_id, contato_id, ultima_mensagem_at)
  values (v_cliente, v_contact, now())
  on conflict (cliente_id, contato_id) do update
    set ultima_mensagem_at = now()
  returning id into v_conv;

  insert into public.crm_messages (
    cliente_id, conversa_id, direcao, tipo, texto, url_midia,
    remetente_nome, remetente_foto, from_me, message_id
  ) values (
    v_cliente, v_conv, 'recebida', v_tipo, v_texto, v_url,
    case when p_is_group then p_participant_name else null end,
    case when p_is_group then v_participant_photo else null end,
    false, p_message_id
  )
  returning id into v_msg;

  return v_msg;
end;
$function$;