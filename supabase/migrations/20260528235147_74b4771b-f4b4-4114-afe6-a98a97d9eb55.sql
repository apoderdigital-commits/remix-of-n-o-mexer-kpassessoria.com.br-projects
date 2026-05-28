CREATE TABLE public.kp_comercial_prospeccao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL DEFAULT 'prospeccao',
  sdr_name text,
  sdr_ghl_id text,
  lead_category text NOT NULL DEFAULT 'Outro',
  contact_name text,
  contact_phone text,
  message text,
  event_at timestamp with time zone NOT NULL DEFAULT now(),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_kp_prospeccao_event_at ON public.kp_comercial_prospeccao (event_at);
CREATE INDEX idx_kp_prospeccao_type ON public.kp_comercial_prospeccao (event_type);

GRANT SELECT ON public.kp_comercial_prospeccao TO authenticated;
GRANT ALL ON public.kp_comercial_prospeccao TO service_role;

ALTER TABLE public.kp_comercial_prospeccao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read prospeccao"
ON public.kp_comercial_prospeccao
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service manage prospeccao"
ON public.kp_comercial_prospeccao
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);