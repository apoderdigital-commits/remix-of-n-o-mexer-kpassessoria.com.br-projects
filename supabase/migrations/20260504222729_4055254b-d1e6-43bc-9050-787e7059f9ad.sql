
ALTER TABLE public.squad_engagement
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_squad_engagement_deleted_at
  ON public.squad_engagement (deleted_at);

CREATE OR REPLACE FUNCTION public.purge_old_squad_engagement()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.squad_engagement
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (now() - interval '30 days');
$$;
