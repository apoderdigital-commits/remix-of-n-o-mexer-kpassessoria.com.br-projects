-- Extends client_report_configs with full per-frequency scheduling.
-- Idempotent: safe to run whether or not the base table already exists.

CREATE TABLE IF NOT EXISTS public.client_report_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  whatsapp_jid text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  metric_source text NOT NULL DEFAULT 'ghl' CHECK (metric_source IN ('ghl', 'planilha')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

-- Daily report (fires on selected weekdays; empty array = every day)
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS daily_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS daily_days smallint[] NOT NULL DEFAULT '{}';
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS daily_time text NOT NULL DEFAULT '08:00';

-- Weekly report (fires on one weekday, covers the past 7 days)
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS weekly_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS weekly_day smallint NOT NULL DEFAULT 1;
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS weekly_time text NOT NULL DEFAULT '08:00';

-- Monthly report (fires on a day of month, covers the past month)
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS monthly_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS monthly_day smallint NOT NULL DEFAULT 1;
ALTER TABLE public.client_report_configs ADD COLUMN IF NOT EXISTS monthly_time text NOT NULL DEFAULT '08:00';

-- Enable RLS + policy (no-op if already enabled)
ALTER TABLE public.client_report_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage report configs" ON public.client_report_configs;
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
