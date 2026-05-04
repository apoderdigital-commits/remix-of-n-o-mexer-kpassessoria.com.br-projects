-- Soft delete for daily sessions (30-day trash)
ALTER TABLE public.squad_daily_sessions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_sds_deleted_at ON public.squad_daily_sessions(deleted_at);

-- Auto-purge sessions soft-deleted more than 30 days ago (called on every list query)
CREATE OR REPLACE FUNCTION public.purge_old_squad_daily_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.squad_daily_sessions
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (now() - interval '30 days');
$$;
