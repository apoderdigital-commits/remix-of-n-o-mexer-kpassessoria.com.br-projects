create extension if not exists pg_net;

alter table public.crm_connections add column if not exists n8n_send_url text;

create or replace function public.crm_after_outgoing()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text;
  v_conn  record;
begin
  if new.direcao <> 'enviada' or coalesce(new.tipo, 'texto') <> 'texto' then
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
                   'instance_id', v_conn.instance_id
                 )
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_crm_after_outgoing on public.crm_messages;
create trigger trg_crm_after_outgoing
  after insert on public.crm_messages
  for each row execute function public.crm_after_outgoing();