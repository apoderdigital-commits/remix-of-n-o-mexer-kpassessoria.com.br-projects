-- ============================================================================
-- Marcar a mensal como concluída também atualiza o evento no Google
-- O título passa a ser "MENSAL FEITA <> {cliente}".
-- Antes, `done` não estava na lista de campos observados: dar como concluída
-- não disparava nada e o evento ficava com o título antigo.
-- Rode depois de squad_agenda_sync_google. Idempotente.
-- ============================================================================

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
  -- `done` entra aqui: concluir a mensal renomeia o evento para "MENSAL FEITA".
  if TG_OP = 'UPDATE'
     and OLD.meeting_date is not distinct from NEW.meeting_date
     and OLD.meeting_time is not distinct from NEW.meeting_time
     and OLD.client_name  is not distinct from NEW.client_name
     and OLD.responsible  is not distinct from NEW.responsible
     and OLD.observations is not distinct from NEW.observations
     and OLD.done         is not distinct from NEW.done then
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
                   'concluida',     coalesce(v_row.done, false),
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
