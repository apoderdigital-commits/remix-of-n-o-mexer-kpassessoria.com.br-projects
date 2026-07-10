GRANT SELECT ON public.client_campaign_filters TO anon;

DROP POLICY IF EXISTS "Public read campaign filter" ON public.client_campaign_filters;
CREATE POLICY "Public read campaign filter" ON public.client_campaign_filters
FOR SELECT TO anon USING (true);