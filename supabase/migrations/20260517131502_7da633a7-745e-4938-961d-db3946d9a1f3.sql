-- Configuração de pipelines: classe (A/B/C) e tipo (sdr/closer)
CREATE TABLE IF NOT EXISTS public.kp_comercial_pipeline_config (
  pipeline_id text PRIMARY KEY,
  pipeline_name text,
  classe text CHECK (classe IN ('A','B','C','Outro')) DEFAULT NULL,
  kind text CHECK (kind IN ('sdr','closer','both')) DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kp_comercial_pipeline_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pipeline config"
  ON public.kp_comercial_pipeline_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin manage pipeline config"
  ON public.kp_comercial_pipeline_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));