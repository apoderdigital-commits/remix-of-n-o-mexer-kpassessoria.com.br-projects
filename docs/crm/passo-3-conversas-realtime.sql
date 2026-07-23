-- ============================================================================
-- CRM KP · PASSO 3 — Conversas com dados reais + Realtime
-- Pré-requisito: rodar o PASSO 1 antes (tabelas crm_*).
-- Idempotente: pode rodar mais de uma vez (a parte de SEED cria dados novos,
-- então rode a seção 4 só quando quiser popular teste).
-- ============================================================================

-- 1) Última mensagem denormalizada na conversa (lista simples e rápida) -------
alter table public.crm_conversations
  add column if not exists ultima_mensagem text,
  add column if not exists ultima_em timestamptz;

-- 2) Trigger: ao inserir mensagem, atualiza a conversa (preview/horário/status)
create or replace function public.crm_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crm_conversations
     set ultima_mensagem = case when new.tipo = 'texto' then new.conteudo else '[' || new.tipo || ']' end,
         ultima_em       = new.criado_em,
         atualizado_em   = now(),
         status          = case when new.direcao = 'recebida' then 'nao_lido' else status end
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_crm_after_message on public.crm_messages;
create trigger trg_crm_after_message
  after insert on public.crm_messages
  for each row execute function public.crm_after_message();

-- 3) REALTIME — publica as duas tabelas (idempotente) ------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='crm_messages') then
    execute 'alter publication supabase_realtime add table public.crm_messages';
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='crm_conversations') then
    execute 'alter publication supabase_realtime add table public.crm_conversations';
  end if;
end $$;

-- payload completo nos eventos de update/delete do Realtime
alter table public.crm_conversations replica identity full;
alter table public.crm_messages      replica identity full;

-- ============================================================================
-- 4) DADOS DE TESTE (opcional) — cria 1 loja fake, liga o SEU login como admin
--    do CRM (assim você vê tudo pela RLS) e cria contatos/conversas/mensagens.
--    Ajuste o e-mail se o seu login for outro.
-- ============================================================================
do $$
declare
  v_cliente uuid;
  v_ct1 uuid; v_ct2 uuid;
  v_cv1 uuid; v_cv2 uuid;
  v_uid uuid;
begin
  insert into public.crm_clients (nome, cidade)
    values ('Loja Teste CRM', 'Manaus')
    returning id into v_cliente;

  select id into v_uid from auth.users where email = 'institucionalagencykp@gmail.com' limit 1;
  if v_uid is not null then
    insert into public.crm_users (auth_user_id, nome, email, cliente_id, papel)
      values (v_uid, 'KP Admin', 'institucionalagencykp@gmail.com', v_cliente, 'admin')
      on conflict (auth_user_id) do update set papel = 'admin', cliente_id = excluded.cliente_id;
  end if;

  insert into public.crm_contacts (cliente_id, nome, telefone, email)
    values (v_cliente, 'João da Moto', '+55 92 99999-0001', 'joao@teste.com') returning id into v_ct1;
  insert into public.crm_contacts (cliente_id, nome, telefone, email)
    values (v_cliente, 'Maria Fernandes', '+55 92 99999-0002', 'maria@teste.com') returning id into v_ct2;

  insert into public.crm_conversations (cliente_id, contact_id, status)
    values (v_cliente, v_ct1, 'nao_lido') returning id into v_cv1;
  insert into public.crm_conversations (cliente_id, contact_id, status)
    values (v_cliente, v_ct2, 'lido') returning id into v_cv2;

  -- o trigger preenche ultima_mensagem/ultima_em automaticamente
  insert into public.crm_messages (cliente_id, conversation_id, direcao, tipo, conteudo, lida) values
    (v_cliente, v_cv1, 'recebida', 'texto', 'Boa tarde, ainda tem a CG 160?', false),
    (v_cliente, v_cv2, 'recebida', 'texto', 'Fechado, passo aí amanhã!', true),
    (v_cliente, v_cv2, 'enviada',  'texto', 'Combinado, te espero!', true);
end $$;

-- ============================================================================
-- Como testar o Realtime e o isolamento por cliente (RLS):
--   • Realtime: abra o app logado em duas abas -> mande mensagem numa,
--     a outra atualiza sozinha (lista + chat).
--   • RLS: crie um 2º usuário no Auth + linha em crm_users apontando pra OUTRA
--     loja (papel 'atendente'); logando com ele, a lista deve mudar (só a loja
--     dele). Admin (papel 'admin') vê todas.
-- ============================================================================
