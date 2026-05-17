
CREATE TABLE IF NOT EXISTS public.kp_comercial_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_user_id text NOT NULL UNIQUE,
  name text,
  email text,
  role text NOT NULL DEFAULT 'none' CHECK (role IN ('sdr','closer','both','none')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kp_comercial_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roles"
  ON public.kp_comercial_user_roles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage roles - insert"
  ON public.kp_comercial_user_roles FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage roles - update"
  ON public.kp_comercial_user_roles FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage roles - delete"
  ON public.kp_comercial_user_roles FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_kp_comercial_user_roles_updated_at
  BEFORE UPDATE ON public.kp_comercial_user_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
