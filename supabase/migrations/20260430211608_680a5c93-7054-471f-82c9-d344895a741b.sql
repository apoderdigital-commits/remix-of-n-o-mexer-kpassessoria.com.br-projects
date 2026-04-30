CREATE OR REPLACE FUNCTION public.user_can_access_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_client_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.client_id = _client_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = _client_id
        AND c.user_id = auth.uid()
        AND c.deleted_at IS NULL
    )
$$;

CREATE OR REPLACE FUNCTION public.get_accessible_clients()
RETURNS TABLE (
  id uuid,
  name text,
  meta_account_id text,
  google_sheet_id text,
  ticket_medio numeric,
  phone text,
  created_at timestamp with time zone,
  has_meta_credentials boolean,
  has_google_sheet boolean,
  has_ghl_credentials boolean,
  has_ticket_medio boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.meta_account_id,
    c.google_sheet_id,
    c.ticket_medio,
    c.phone,
    c.created_at,
    (c.meta_account_id IS NOT NULL AND (c.meta_access_token IS NOT NULL OR c.meta_token_id IS NOT NULL)) AS has_meta_credentials,
    (c.google_sheet_id IS NOT NULL) AS has_google_sheet,
    (c.ghl_api_key IS NOT NULL AND c.ghl_location_id IS NOT NULL) AS has_ghl_credentials,
    (c.ticket_medio IS NOT NULL) AS has_ticket_medio
  FROM public.clients c
  WHERE c.deleted_at IS NULL
    AND public.user_can_access_client(c.id)
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_clients() TO authenticated;

DROP POLICY IF EXISTS "Client users can view own campaigns" ON public.meta_campaigns;
CREATE POLICY "Client users can view accessible campaigns"
ON public.meta_campaigns
FOR SELECT
TO authenticated
USING (public.user_can_access_client(client_id));

DROP POLICY IF EXISTS "Client users can view own leads" ON public.qualified_leads;
CREATE POLICY "Client users can view accessible leads"
ON public.qualified_leads
FOR SELECT
TO authenticated
USING (public.user_can_access_client(client_id));