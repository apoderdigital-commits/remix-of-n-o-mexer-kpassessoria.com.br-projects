CREATE TABLE IF NOT EXISTS public.client_report_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  whatsapp_jid text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  metric_source text NOT NULL DEFAULT 'ghl' CHECK (metric_source IN ('ghl','planilha')),
  daily_enabled  boolean  NOT NULL DEFAULT false,
  daily_days     smallint[] NOT NULL DEFAULT '{}',
  daily_time     text NOT NULL DEFAULT '08:00',
  weekly_enabled boolean  NOT NULL DEFAULT false,
  weekly_day     smallint NOT NULL DEFAULT 1,
  weekly_time    text NOT NULL DEFAULT '08:00',
  monthly_enabled boolean NOT NULL DEFAULT false,
  monthly_day     smallint NOT NULL DEFAULT 1,
  monthly_time    text NOT NULL DEFAULT '08:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_report_configs TO authenticated;
GRANT ALL ON public.client_report_configs TO service_role;

ALTER TABLE public.client_report_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage report configs" ON public.client_report_configs;

CREATE POLICY "Admins manage report configs"
ON public.client_report_configs
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'manager'::app_role)
);

CREATE TRIGGER update_client_report_configs_updated_at
BEFORE UPDATE ON public.client_report_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();