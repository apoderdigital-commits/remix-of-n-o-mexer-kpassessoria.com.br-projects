
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins and managers can view clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and managers can view campaigns" ON public.meta_campaigns;
DROP POLICY IF EXISTS "Admins can insert campaigns" ON public.meta_campaigns;
DROP POLICY IF EXISTS "Admins and managers can view qualified_leads" ON public.qualified_leads;
DROP POLICY IF EXISTS "Service can insert qualified_leads" ON public.qualified_leads;

-- Temporary open policies (replace with role-based once auth is added)
CREATE POLICY "Allow all access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to meta_campaigns" ON public.meta_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to qualified_leads" ON public.qualified_leads FOR ALL USING (true) WITH CHECK (true);
