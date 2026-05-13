CREATE TABLE public.squad_consolidated_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  client_id uuid NOT NULL,
  week_start date NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  week_summary text NOT NULL DEFAULT '',
  problem_area text,
  problem_description text,
  action_plan text,
  assignee text,
  deadline date,
  status text NOT NULL DEFAULT 'pendente',
  observations text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scn_squad_week ON public.squad_consolidated_notes(squad_id, week_start DESC);
CREATE INDEX idx_scn_client_week ON public.squad_consolidated_notes(client_id, week_start DESC);

CREATE TRIGGER squad_consolidated_notes_updated_at BEFORE UPDATE ON public.squad_consolidated_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.squad_consolidated_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage consolidated notes" ON public.squad_consolidated_notes
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members view consolidated notes" ON public.squad_consolidated_notes
  FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert consolidated notes" ON public.squad_consolidated_notes
  FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update consolidated notes" ON public.squad_consolidated_notes
  FOR UPDATE TO authenticated USING (user_in_squad(squad_id))
  WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members delete consolidated notes" ON public.squad_consolidated_notes
  FOR DELETE TO authenticated USING (user_in_squad(squad_id));

CREATE TABLE public.squad_consolidated_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  week_start date NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_seconds integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_scs_squad_week ON public.squad_consolidated_sessions(squad_id, week_start DESC);

ALTER TABLE public.squad_consolidated_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage consolidated sessions" ON public.squad_consolidated_sessions
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members view consolidated sessions" ON public.squad_consolidated_sessions
  FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert consolidated sessions" ON public.squad_consolidated_sessions
  FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update consolidated sessions" ON public.squad_consolidated_sessions
  FOR UPDATE TO authenticated USING (user_in_squad(squad_id))
  WITH CHECK (user_in_squad(squad_id));