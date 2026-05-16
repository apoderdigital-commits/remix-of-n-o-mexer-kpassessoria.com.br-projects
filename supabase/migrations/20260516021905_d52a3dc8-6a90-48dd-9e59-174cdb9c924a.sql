CREATE TABLE public.kp_comercial_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  block TEXT NOT NULL DEFAULT 'full',
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER,
  error TEXT
);

CREATE INDEX idx_kp_snapshots_recent ON public.kp_comercial_snapshots (block, fetched_at DESC);
CREATE INDEX idx_kp_snapshots_period ON public.kp_comercial_snapshots (period_start, period_end, fetched_at DESC);

ALTER TABLE public.kp_comercial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers view snapshots"
ON public.kp_comercial_snapshots
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Service can manage snapshots"
ON public.kp_comercial_snapshots
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins manage snapshots"
ON public.kp_comercial_snapshots
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));