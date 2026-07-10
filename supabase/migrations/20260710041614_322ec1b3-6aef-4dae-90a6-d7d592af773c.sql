CREATE TABLE public.client_campaign_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  excluded_campaigns TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_campaign_filters TO authenticated;
GRANT ALL ON public.client_campaign_filters TO service_role;

ALTER TABLE public.client_campaign_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view allowed client filters"
  ON public.client_campaign_filters
  FOR SELECT
  TO authenticated
  USING (public.user_can_access_client(client_id));

CREATE POLICY "Users can create filters for allowed clients"
  ON public.client_campaign_filters
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_access_client(client_id));

CREATE POLICY "Users can update allowed client filters"
  ON public.client_campaign_filters
  FOR UPDATE
  TO authenticated
  USING (public.user_can_access_client(client_id))
  WITH CHECK (public.user_can_access_client(client_id));

CREATE POLICY "Users can delete allowed client filters"
  ON public.client_campaign_filters
  FOR DELETE
  TO authenticated
  USING (public.user_can_access_client(client_id));

CREATE TRIGGER update_client_campaign_filters_updated_at
  BEFORE UPDATE ON public.client_campaign_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();