create or replace function public.crm_after_outgoing()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text;
  v_conn  record;
  v_tipo  text;
begin
  if new.direcao <> 'enviada' then
    return new;
  end if;

  v_tipo := coalesce(new.tipo, 'texto');
  if v_tipo not in ('texto','audio','imagem','video') then
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
                   'message', new.conteudo,
                   'tipo', v_tipo,
                   'url_midia', new.url_midia,
                   'instance_id', v_conn.instance_id
                 )
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;