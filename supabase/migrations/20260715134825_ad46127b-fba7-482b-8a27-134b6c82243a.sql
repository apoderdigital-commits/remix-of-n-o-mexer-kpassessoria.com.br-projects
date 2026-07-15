
CREATE TABLE public.password_reset_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_reset_verifications TO service_role;
ALTER TABLE public.password_reset_verifications ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (edge functions) touches this table.
CREATE INDEX password_reset_verifications_user_id_idx ON public.password_reset_verifications(user_id);
CREATE INDEX password_reset_verifications_created_at_idx ON public.password_reset_verifications(created_at DESC);
