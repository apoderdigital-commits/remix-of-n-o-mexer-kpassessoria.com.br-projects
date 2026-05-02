ALTER TABLE public.user_creation_verifications
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'create_user';

ALTER TABLE public.user_creation_verifications
  ALTER COLUMN action DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_user_creation_verifications_action
  ON public.user_creation_verifications(requested_by, action, consumed_at);