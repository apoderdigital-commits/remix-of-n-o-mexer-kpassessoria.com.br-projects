-- ============================================================================
-- CRM · Passo 6b — Ingestão de WhatsApp SEM service_role
-- (Lovable Cloud não expõe a service_role key.) A função passa a validar um
-- SEGREDO próprio por conexão (crm_connections.webhook_secret). Assim o n8n
-- pode chamar com a chave pública (anon) que a função só executa se o segredo
-- bater. Rode depois do passo 6.
-- ============================================================================

alter table public.crm_connections add column if not exists webhook_secret text;

-- remove a versão antiga (5 args) que dependia da service_role
drop function if exists public.crm_ingest_whatsapp(text, text, text, text, text);

create or replace function public.crm_ingest_whatsapp(
  p_secret      text,
  p_instance_id text,
  p_phone       text,
  p_nome        text default null,
  p_texto       text default null,
  p_message_id  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid;
  v_contact uuid;
  v_conv    uuid;
  v_msg     uuid;
begin
  if coalesce(p_phone, '') = '' then
    raise exception 'phone vazio';
  end if;

  -- loja dona da instância + validação do segredo do webhook
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

  -- contato (get-or-create por telefone)
  select id into v_contact from public.crm_contacts
   where cliente_id = v_cliente and telefone = p_phone limit 1;
  if v_contact is null then
    insert into public.crm_contacts (cliente_id, nome, telefone)
      values (v_cliente, nullif(p_nome, ''), p_phone)
      returning id into v_contact;
  elsif nullif(p_nome, '') is not null then
    update public.crm_contacts set nome = coalesce(nome, p_nome) where id = v_contact;
  end if;

  -- conversa (get-or-create por contato)
  select id into v_conv from public.crm_conversations
   where contact_id = v_contact order by criado_em limit 1;
  if v_conv is null then
    insert into public.crm_conversations (cliente_id, contact_id, status)
      values (v_cliente, v_contact, 'nao_lido')
      returning id into v_conv;
  end if;

  -- mensagem recebida (o trigger da conversa atualiza preview/horario/status)
  insert into public.crm_messages (cliente_id, conversation_id, direcao, tipo, conteudo, lida)
    values (v_cliente, v_conv, 'recebida', 'texto', p_texto, false)
    returning id into v_msg;

  return v_msg;
end;
$$;

-- a função valida o segredo internamente -> pode ser chamada com a anon key
revoke all on function public.crm_ingest_whatsapp(text, text, text, text, text, text) from public;
grant execute on function public.crm_ingest_whatsapp(text, text, text, text, text, text) to anon, authenticated, service_role;
