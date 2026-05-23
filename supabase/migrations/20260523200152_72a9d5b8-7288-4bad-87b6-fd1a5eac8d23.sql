
-- 1) Add stage mappings to existing pipeline config table
ALTER TABLE public.kp_comercial_pipeline_config
  ADD COLUMN IF NOT EXISTS stages_reuniao_marcada text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stages_comparecida    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stages_proposta_enviada text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stages_proposta_perdida text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stages_vendida        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stages_noshow         text[] NOT NULL DEFAULT '{}';

-- 2) Singleton table for data source preferences
CREATE TABLE IF NOT EXISTS public.kp_comercial_data_sources (
  id boolean PRIMARY KEY DEFAULT true,
  leads_source text NOT NULL DEFAULT 'sheet',         -- 'sheet' | 'ghl'
  mqls_source  text NOT NULL DEFAULT 'sheet',         -- 'sheet' | 'ghl'
  comparecidas_source text NOT NULL DEFAULT 'ghl',    -- 'ghl' | 'sheet'
  vendas_source text NOT NULL DEFAULT 'ghl',          -- 'ghl' | 'sheet'
  sheet_id text NOT NULL DEFAULT '1esmBP_vybIjhh2aw7miaS-oZMp9pDeroAUhYFaiTs9c',
  sheet_tab text NOT NULL DEFAULT 'Página4',
  sheet_mql_column text NOT NULL DEFAULT 'MQL',
  sheet_mql_value text NOT NULL DEFAULT 'SIM',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton_only CHECK (id = true)
);

ALTER TABLE public.kp_comercial_data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read data sources" ON public.kp_comercial_data_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage data sources" ON public.kp_comercial_data_sources
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed singleton row
INSERT INTO public.kp_comercial_data_sources (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;
