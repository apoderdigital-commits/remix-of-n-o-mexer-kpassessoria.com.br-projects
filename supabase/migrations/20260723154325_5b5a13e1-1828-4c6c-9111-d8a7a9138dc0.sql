DROP FUNCTION IF EXISTS public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text);

GRANT EXECUTE ON FUNCTION public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_ingest_whatsapp(text, text, text, text, text, text, boolean, text, text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';