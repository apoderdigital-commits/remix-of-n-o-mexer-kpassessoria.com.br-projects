
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager');

-- Create lead status enum
CREATE TYPE public.lead_status AS ENUM ('cpf_approved', 'sale');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  meta_account_id TEXT,
  meta_access_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can manage clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create meta_campaigns table
CREATE TABLE public.meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  campaign_name TEXT,
  ad_name TEXT NOT NULL,
  leads_total INTEGER NOT NULL DEFAULT 0,
  amount_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view campaigns" ON public.meta_campaigns
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "System can manage campaigns" ON public.meta_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create qualified_leads table
CREATE TABLE public.qualified_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  creative_name TEXT NOT NULL,
  status lead_status NOT NULL,
  lead_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.qualified_leads ENABLE ROW LEVEL SECURITY;

-- Webhook can insert (anon role for webhook access)
CREATE POLICY "Webhook can insert leads" ON public.qualified_leads
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authorized users can view leads" ON public.qualified_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Service role can insert (for edge functions)
CREATE POLICY "Service can manage leads" ON public.qualified_leads
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can manage campaigns (for edge functions)
CREATE POLICY "Service can manage campaigns" ON public.meta_campaigns
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_meta_campaigns_client_date ON public.meta_campaigns(client_id, date);
CREATE INDEX idx_qualified_leads_client_date ON public.qualified_leads(client_id, lead_date);
CREATE INDEX idx_qualified_leads_creative ON public.qualified_leads(creative_name);
