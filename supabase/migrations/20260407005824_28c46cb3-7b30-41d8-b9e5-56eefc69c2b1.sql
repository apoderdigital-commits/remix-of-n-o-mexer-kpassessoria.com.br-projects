
-- Remove overly permissive policies
DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all access to meta_campaigns" ON public.meta_campaigns;
DROP POLICY IF EXISTS "Allow all access to qualified_leads" ON public.qualified_leads;

-- Client users can view their own campaigns
CREATE POLICY "Client users can view own campaigns"
  ON public.meta_campaigns FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Client users can view their own leads
CREATE POLICY "Client users can view own leads"
  ON public.qualified_leads FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
