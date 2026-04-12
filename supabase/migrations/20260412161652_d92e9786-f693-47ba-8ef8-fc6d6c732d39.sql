-- Add 'client' role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- Which clients a user can access
CREATE TABLE public.user_client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

ALTER TABLE public.user_client_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client access"
  ON public.user_client_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own client access"
  ON public.user_client_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Which dashboards a user can access
CREATE TABLE public.user_dashboard_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  dashboard_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, dashboard_key)
);

ALTER TABLE public.user_dashboard_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dashboard access"
  ON public.user_dashboard_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own dashboard access"
  ON public.user_dashboard_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);