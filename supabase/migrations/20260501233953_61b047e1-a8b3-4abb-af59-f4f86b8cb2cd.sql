CREATE TABLE public.user_creation_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by UUID NOT NULL,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_creation_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own verifications"
  ON public.user_creation_verifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND requested_by = auth.uid());

CREATE POLICY "Admins can insert own verifications"
  ON public.user_creation_verifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND requested_by = auth.uid());

CREATE POLICY "Admins can update own verifications"
  ON public.user_creation_verifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND requested_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND requested_by = auth.uid());

CREATE INDEX idx_user_creation_verifications_requested_by ON public.user_creation_verifications(requested_by, created_at DESC);