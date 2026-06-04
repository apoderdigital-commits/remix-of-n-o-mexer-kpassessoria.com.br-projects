CREATE POLICY "Public read meta_campaigns"
ON public.meta_campaigns FOR SELECT
TO anon
USING (true);

CREATE POLICY "Public read qualified_leads"
ON public.qualified_leads FOR SELECT
TO anon
USING (true);