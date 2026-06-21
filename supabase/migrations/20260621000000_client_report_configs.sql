CREATE TABLE IF NOT EXISTS public.client_report_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  whatsapp_jid text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  send_day smallint NOT NULL DEFAULT 1,
  send_time text NOT NULL DEFAULT '08:00',
  metric_source text NOT NULL DEFAULT 'ghl' CHECK (metric_source IN ('ghl', 'planilha')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.client_report_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage report configs"
ON public.client_report_configs
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);
