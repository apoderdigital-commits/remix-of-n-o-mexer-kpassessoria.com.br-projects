-- ============================================================================
-- CRM Multi-conta · Fase 4 — Z-API por subconta
-- Cada subconta guarda sua PRÓPRIA credencial do Z-API em crm_connections.
-- O gatilho de envio passa a mandar instance_id + token + client_token pro n8n,
-- pra UM só workflow de envio atender todas as subcontas (dinâmico).
-- Retrocompatível: o n8n só usa esses campos quando você atualizar o fluxo (4b).
-- Rode depois dos passos anteriores. Idempotente.
-- ============================================================================

alter table public.crm_connections add column if not exists zapi_token        text;
alter table public.crm_connections add column if not exists zapi_client_token text;

-- Gatilho de envio: inclui token/client_token da subconta no payload do n8n
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
                   'instance_id', v_conn.instance_id,
                   'token', v_conn.zapi_token,
                   'client_token', v_conn.zapi_client_token
                 )
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;
