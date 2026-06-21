-- Agendador interno: roda dispatch-reports de hora em hora.
-- A função em si verifica o fuso de São Paulo e decide quem dispara agora.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (se existir) para evitar duplicar
do $$
begin
  perform cron.unschedule('dispatch-reports-hourly');
exception when others then
  null;
end $$;

-- Roda no minuto 0 de toda hora
select cron.schedule(
  'dispatch-reports-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://ymomudnyzgmtlpgdjqib.supabase.co/functions/v1/dispatch-reports',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
