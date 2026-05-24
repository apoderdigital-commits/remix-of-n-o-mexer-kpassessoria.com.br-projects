
ALTER TABLE public.kp_comercial_data_sources
  ADD COLUMN IF NOT EXISTS opportunity_source_filter text NOT NULL DEFAULT 'METAADS',
  ADD COLUMN IF NOT EXISTS opportunity_source_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meetings_source text NOT NULL DEFAULT 'pipeline';

CREATE TABLE IF NOT EXISTS public.kp_comercial_calendars (
  ghl_calendar_id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kp_comercial_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read calendars" ON public.kp_comercial_calendars;
CREATE POLICY "Authenticated read calendars"
  ON public.kp_comercial_calendars FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage calendars" ON public.kp_comercial_calendars;
CREATE POLICY "Admin manage calendars"
  ON public.kp_comercial_calendars FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service manage calendars" ON public.kp_comercial_calendars;
CREATE POLICY "Service manage calendars"
  ON public.kp_comercial_calendars FOR ALL TO service_role USING (true) WITH CHECK (true);
