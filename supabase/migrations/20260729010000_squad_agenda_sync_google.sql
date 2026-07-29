-- ============================================================================
-- Sincronização da Agenda das Mensais com o Google Agenda (via n8n)
--   marcar/editar/excluir aqui  ->  gatilho  ->  n8n  ->  Google Agenda
-- O n8n devolve o id do evento chamando crm_squad_agenda_set_event_id, para
-- que editar/excluir depois atinja o evento certo.
-- Rode depois de squad_google_agenda. Idempotente.
-- ============================================================================

-- URL do fluxo do n8n. Trocar aqui se o webhook mudar.
-- (mesmo estilo do REPORT_WEBHOOK_URL usado no app)
create or replace function public.squad_agenda_n8n_url()
returns text language sql immutable as $$
  select 'https://kpadm-n8n.a6hrr3.easypanel.host/webhook/squad-agenda'::text
$$;

-- Segredo compartilhado com o n8n (mesmo valor no fluxo).
create or replace function public.squad_agenda_secret()
returns text language sql immutable as $$
  select 'kpag_4b3133dc89f98ebab8aa28ad2ec9533f'::text
$$;

-- ── Gatilho: avisa o n8n a cada mudança relevante ───────────────────────────
create or replace function public.squad_agenda_sync_google()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_squad   record;
  v_row     record;
  v_acao    text;
  v_evento  text;
begin
  if TG_OP = 'DELETE' then
    v_row := OLD; v_acao := 'delete'; v_evento := OLD.google_event_id;
  else
    v_row := NEW; v_evento := NEW.google_event_id;
    v_acao := case when NEW.google_event_id is null then 'create' else 'update' end;
  end if;

  select * into v_squad from public.squads where id = v_row.squad_id;
  -- Squad sem agenda configurada não sincroniza.
  if v_squad is null or coalesce(v_squad.google_calendar_id, '') = '' then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  -- Sem data marcada não há evento. Se ANTES tinha e agora não tem mais,
  -- o evento precisa ser removido do Google.
  if TG_OP <> 'DELETE' and NEW.meeting_date is null then
    if v_evento is null then
      return NEW;
    end if;
    v_acao := 'delete';
  end if;

  -- Nada mudou no que interessa ao evento? Não incomoda o n8n.
  if TG_OP = 'UPDATE'
     and OLD.meeting_date is not distinct from NEW.meeting_date
     and OLD.meeting_time is not distinct from NEW.meeting_time
     and OLD.client_name  is not distinct from NEW.client_name
     and OLD.responsible  is not distinct from NEW.responsible
     and OLD.observations is not distinct from NEW.observations then
    return NEW;
  end if;

  begin
    perform net.http_post(
      url     := public.squad_agenda_n8n_url(),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
                   'secret',        public.squad_agenda_secret(),
                   'acao',          v_acao,
                   'agenda_id',     v_row.id,
                   'event_id',      v_evento,
                   'calendar_id',   v_squad.google_calendar_id,
                   'timezone',      coalesce(v_squad.google_calendar_tz, 'America/Sao_Paulo'),
                   'duracao_min',   coalesce(v_squad.google_event_minutos, 60),
                   'squad',         v_squad.name,
                   'cliente',       v_row.client_name,
                   'responsavel',   v_row.responsible,
                   'observacoes',   v_row.observations,
                   'data',          v_row.meeting_date,
                   'hora',          coalesce(substring(v_row.meeting_time::text from 1 for 5), '09:00')
                 )
    );
  exception when others then
    -- Google fora do ar não pode impedir de salvar a reunião aqui.
    null;
  end;

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

drop trigger if exists squad_agenda_google_sync on public.squad_agenda;
create trigger squad_agenda_google_sync
  after insert or update or delete on public.squad_agenda
  for each row execute function public.squad_agenda_sync_google();

-- ── RPC que o n8n chama para devolver o id do evento ────────────────────────
-- Sem service_role no Lovable Cloud, a proteção é o segredo compartilhado.
create or replace function public.squad_agenda_set_event_id(
  p_secret    text,
  p_agenda_id uuid,
  p_event_id  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from public.squad_agenda_secret() then
    raise exception 'segredo invalido';
  end if;
  -- Atualiza direto, sem passar pelo gatilho de novo (o gatilho ignora quando
  -- só o google_event_id muda, por não estar na lista de campos observados).
  update public.squad_agenda
     set google_event_id = nullif(p_event_id, '')
   where id = p_agenda_id;
end;
$$;

grant execute on function public.squad_agenda_set_event_id(text, uuid, text) to anon, authenticated;
