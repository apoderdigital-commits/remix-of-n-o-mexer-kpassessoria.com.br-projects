
DROP FUNCTION IF EXISTS public.get_accessible_clients();

CREATE OR REPLACE FUNCTION public.get_accessible_clients()
 RETURNS TABLE(id uuid, name text, meta_account_id text, google_sheet_id text, ticket_medio numeric, phone text, created_at timestamp with time zone, squad_id uuid, has_meta_credentials boolean, has_google_sheet boolean, has_ghl_credentials boolean, has_ticket_medio boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.name,
    c.meta_account_id,
    c.google_sheet_id,
    c.ticket_medio,
    c.phone,
    c.created_at,
    c.squad_id,
    (c.meta_account_id IS NOT NULL AND (c.meta_access_token IS NOT NULL OR c.meta_token_id IS NOT NULL)) AS has_meta_credentials,
    (c.google_sheet_id IS NOT NULL) AS has_google_sheet,
    (c.ghl_api_key IS NOT NULL AND c.ghl_location_id IS NOT NULL) AS has_ghl_credentials,
    (c.ticket_medio IS NOT NULL) AS has_ticket_medio
  FROM public.clients c
  WHERE c.deleted_at IS NULL
    AND public.user_can_access_client(c.id)
  ORDER BY c.name;
$function$;
