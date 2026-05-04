
-- NPS by period
CREATE TABLE public.squad_nps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  period date NOT NULL,
  total_clients integer,
  responses integer,
  detractors integer,
  neutrals integer,
  promoters integer,
  nps_score numeric,
  avg_engagement numeric,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.squad_nps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage squad nps" ON public.squad_nps FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Members view squad nps" ON public.squad_nps FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert squad nps" ON public.squad_nps FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update squad nps" ON public.squad_nps FOR UPDATE TO authenticated USING (user_in_squad(squad_id)) WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members delete squad nps" ON public.squad_nps FOR DELETE TO authenticated USING (user_in_squad(squad_id));
CREATE TRIGGER squad_nps_updated BEFORE UPDATE ON public.squad_nps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Engagement monthly per client
CREATE TABLE public.squad_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  reference_month date NOT NULL,
  client_name text NOT NULL,
  contact text,
  curve_abc text,
  sprint text,
  engagement_score integer,
  nps_individual integer,
  observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.squad_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage squad engagement" ON public.squad_engagement FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Members view squad engagement" ON public.squad_engagement FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert squad engagement" ON public.squad_engagement FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update squad engagement" ON public.squad_engagement FOR UPDATE TO authenticated USING (user_in_squad(squad_id)) WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members delete squad engagement" ON public.squad_engagement FOR DELETE TO authenticated USING (user_in_squad(squad_id));
CREATE TRIGGER squad_engagement_updated BEFORE UPDATE ON public.squad_engagement FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agenda
CREATE TABLE public.squad_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  reference_month date NOT NULL,
  category text,
  client_name text NOT NULL,
  responsible text,
  meeting_date date,
  meeting_time time,
  done boolean NOT NULL DEFAULT false,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.squad_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage squad agenda" ON public.squad_agenda FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Members view squad agenda" ON public.squad_agenda FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert squad agenda" ON public.squad_agenda FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update squad agenda" ON public.squad_agenda FOR UPDATE TO authenticated USING (user_in_squad(squad_id)) WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members delete squad agenda" ON public.squad_agenda FOR DELETE TO authenticated USING (user_in_squad(squad_id));
CREATE TRIGGER squad_agenda_updated BEFORE UPDATE ON public.squad_agenda FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_squad_nps_squad ON public.squad_nps(squad_id, period DESC);
CREATE INDEX idx_squad_engagement_squad ON public.squad_engagement(squad_id, reference_month DESC);
CREATE INDEX idx_squad_agenda_squad ON public.squad_agenda(squad_id, reference_month DESC);
