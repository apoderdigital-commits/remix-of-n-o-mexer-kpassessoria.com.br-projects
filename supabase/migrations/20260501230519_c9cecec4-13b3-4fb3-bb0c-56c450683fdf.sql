
CREATE TABLE IF NOT EXISTS public.ai_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  since DATE NOT NULL,
  until DATE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('summary','alerts')),
  payload_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_insights_cache_unique
  ON public.ai_insights_cache (client_id, since, until, mode);

CREATE INDEX IF NOT EXISTS ai_insights_cache_lookup
  ON public.ai_insights_cache (client_id, mode, since, until);

ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai cache"
  ON public.ai_insights_cache FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ai cache"
  ON public.ai_insights_cache FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update ai cache"
  ON public.ai_insights_cache FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ai cache"
  ON public.ai_insights_cache FOR DELETE
  TO authenticated USING (true);
