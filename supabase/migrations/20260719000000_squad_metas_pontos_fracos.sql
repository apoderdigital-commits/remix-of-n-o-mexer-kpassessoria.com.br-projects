-- Fechamento Operacional: tabela de metas por cliente
-- 1) Pontos fracos configuráveis (só admin gerencia; todos leem)
CREATE TABLE IF NOT EXISTS public.squad_weak_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.squad_weak_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read weak points" ON public.squad_weak_points
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage weak points" ON public.squad_weak_points
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Notas de metas por cliente/mês (pontos fracos selecionados + observações)
CREATE TABLE IF NOT EXISTS public.squad_goal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  reference_month text NOT NULL,
  weak_points text[] NOT NULL DEFAULT '{}',
  observacoes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, client_name, reference_month)
);
ALTER TABLE public.squad_goal_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_squad_goal_notes ON public.squad_goal_notes(squad_id, reference_month);
CREATE POLICY "Squad members view goal notes" ON public.squad_goal_notes
  FOR SELECT TO authenticated USING (public.user_in_squad(squad_id));
CREATE POLICY "Squad members manage goal notes" ON public.squad_goal_notes
  FOR ALL TO authenticated
  USING (public.user_in_squad(squad_id))
  WITH CHECK (public.user_in_squad(squad_id));

-- 3) Pontos fracos iniciais (os do modelo do gestor)
INSERT INTO public.squad_weak_points (label, sort_order) VALUES
  ('Taxa de Conversão', 1), ('Investimento', 2), ('Ticket Médio', 3),
  ('Aquisição', 4), ('CPS Mídia', 5), ('Ações Comerciais', 6),
  ('Retenção', 7), ('ROAS', 8), ('Sessões Orgânicas', 9)
ON CONFLICT DO NOTHING;
