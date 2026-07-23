-- ============================================================================
-- CRM Multi-conta · Fase 4b — envio dinâmico + segredo unificado
-- 1) O gatilho de envio manda pro n8n TUDO que o fluxo dinâmico precisa:
--    phone, message, tipo, url_midia + credenciais da subconta (instance/token/client-token).
--    Fica valendo para TODOS os tipos (texto, áudio, imagem, vídeo).
-- 2) Todas as subcontas passam a usar o MESMO segredo do webhook (o que está no n8n),
--    já que o fluxo de recebimento é único e roteia pela instância.
-- Rode depois do passo 9. Idempotente.
-- ============================================================================

-- 0) Garante TODAS as colunas usadas pelo formulário de Conexões da subconta.
--    (Corrige o erro "Could not find the 'zapi_client_token' column ...":
--     o passo 9 não tinha sido aplicado.) Tudo "if not exists" = seguro rodar de novo.
alter table public.crm_connections add column if not exists zapi_token        text;
alter table public.crm_connections add column if not exists zapi_client_token text;
alter table public.crm_connections add column if not exists n8n_send_url       text;
alter table public.crm_connections add column if not exists webhook_secret     text;

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
  -- todas as mensagens ENVIADAS pelo CRM (texto e mídia)
  if new.direcao <> 'enviada' then
    return new;
  end if;

  -- telefone/destino do contato da conversa
  select ct.telefone into v_phone
    from public.crm_conversations cv
    join public.crm_contacts ct on ct.id = cv.contact_id
   where cv.id = new.conversation_id;
  if v_phone is null then return new; end if;

  -- conexão (credenciais) da subconta
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
                   'tipo', coalesce(new.tipo, 'texto'),
                   'url_midia', new.url_midia,
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

-- Segredo do webhook unificado (o mesmo que o n8n de recebimento envia)
update public.crm_connections
   set webhook_secret = 'kpwh_72793a36df318e7593cc8bf97478d99b'
 where webhook_secret is distinct from 'kpwh_72793a36df318e7593cc8bf97478d99b';
