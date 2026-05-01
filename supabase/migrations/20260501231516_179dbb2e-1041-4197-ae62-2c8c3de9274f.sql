DROP POLICY IF EXISTS "Authenticated users can read ai cache" ON public.ai_insights_cache;
DROP POLICY IF EXISTS "Authenticated users can insert ai cache" ON public.ai_insights_cache;
DROP POLICY IF EXISTS "Authenticated users can update ai cache" ON public.ai_insights_cache;
DROP POLICY IF EXISTS "Authenticated users can delete ai cache" ON public.ai_insights_cache;

CREATE POLICY "Read ai cache for accessible clients"
  ON public.ai_insights_cache FOR SELECT
  TO authenticated
  USING (public.user_can_access_client(client_id));

CREATE POLICY "Admins manage ai cache"
  ON public.ai_insights_cache FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));