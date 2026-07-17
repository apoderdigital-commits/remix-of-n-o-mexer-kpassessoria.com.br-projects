CREATE TABLE IF NOT EXISTS public.squad_fechamento_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id uuid NOT NULL,
  reference_month date NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_fechamento_sessions TO authenticated;
GRANT ALL ON public.squad_fechamento_sessions TO service_role;

ALTER TABLE public.squad_fechamento_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fechamento sessions acesso" ON public.squad_fechamento_sessions;
CREATE POLICY "Fechamento sessions acesso" ON public.squad_fechamento_sessions
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fech_sessions_squad_month
  ON public.squad_fechamento_sessions (squad_id, reference_month);

-- Planejamento estratégico: Sim / Não / não respondido
ALTER TABLE public.squad_engagement ALTER COLUMN plano_estrategico DROP DEFAULT;
ALTER TABLE public.squad_engagement ALTER COLUMN plano_estrategico DROP NOT NULL;
UPDATE public.squad_engagement SET plano_estrategico = NULL WHERE plano_estrategico = false;