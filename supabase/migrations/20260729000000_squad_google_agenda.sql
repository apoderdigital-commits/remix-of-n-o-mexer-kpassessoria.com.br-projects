-- ============================================================================
-- Agenda do Google por squad
-- Cada squad tem um Head que faz as mensais; o evento é criado na agenda dele.
-- `google_calendar_id` é o e-mail da agenda (ex.: will@kpassessoria.com.br) ou
-- o ID de uma agenda secundária. Vazio = squad não sincroniza.
-- `google_event_id` guarda o id do evento criado, para editar/apagar o evento
-- certo depois — sem isso, remarcar aqui deixaria o evento antigo no Google.
-- Idempotente.
-- ============================================================================

alter table public.squads
  add column if not exists google_calendar_id text;

-- Fuso usado para montar o horário do evento a partir de meeting_date +
-- meeting_time, que são gravados sem fuso.
alter table public.squads
  add column if not exists google_calendar_tz text not null default 'America/Sao_Paulo';

-- Minutos de duração padrão da mensal (o agendamento guarda só o início).
alter table public.squads
  add column if not exists google_event_minutos integer not null default 60;

alter table public.squad_agenda
  add column if not exists google_event_id text;

create index if not exists squad_agenda_google_event_id_idx
  on public.squad_agenda (google_event_id);
