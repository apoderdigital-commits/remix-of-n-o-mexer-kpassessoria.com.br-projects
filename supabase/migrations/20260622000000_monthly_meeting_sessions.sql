-- Reunião Mensal: sessão (timer 1h) + arquivo de projeção guardado pra sempre.

-- 1) Bucket de storage para as projeções exportadas
INSERT INTO storage.buckets (id, name, public)
VALUES ('projecoes', 'projecoes', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket: usuários autenticados leem e enviam
DROP POLICY IF EXISTS "Projecoes leitura" ON storage.objects;
CREATE POLICY "Projecoes leitura" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'projecoes');

DROP POLICY IF EXISTS "Projecoes upload" ON storage.objects;
CREATE POLICY "Projecoes upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'projecoes');

DROP POLICY IF EXISTS "Projecoes update" ON storage.objects;
CREATE POLICY "Projecoes update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'projecoes');

-- 2) Sessões de reunião mensal (início/fim, encerramento antecipado, arquivo)
CREATE TABLE IF NOT EXISTS public.squad_monthly_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  reference_month text NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  early_end_reason text,
  projection_file_url text,
  projection_file_name text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.squad_monthly_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage monthly sessions" ON public.squad_monthly_sessions;
CREATE POLICY "Members manage monthly sessions" ON public.squad_monthly_sessions
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
