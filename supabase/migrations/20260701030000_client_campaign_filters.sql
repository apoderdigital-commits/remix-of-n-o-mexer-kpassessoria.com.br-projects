-- Filtro de campanhas por cliente (global, não por usuário): quais campanhas EXCLUIR do investimento/leads.
CREATE TABLE IF NOT EXISTS public.client_campaign_filters (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  excluded_campaigns text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.client_campaign_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read campaign filter with access" ON public.client_campaign_filters;
CREATE POLICY "Read campaign filter with access" ON public.client_campaign_filters
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.user_client_access uca WHERE uca.user_id = auth.uid() AND uca.client_id = client_campaign_filters.client_id)
);

DROP POLICY IF EXISTS "Write campaign filter admin manager" ON public.client_campaign_filters;
CREATE POLICY "Write campaign filter admin manager" ON public.client_campaign_filters
FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)
) WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)
);
