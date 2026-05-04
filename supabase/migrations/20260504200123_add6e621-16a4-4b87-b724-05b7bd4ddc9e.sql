CREATE TABLE public.squad_daily_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  delay_seconds integer NOT NULL DEFAULT 0,
  on_time boolean NOT NULL DEFAULT true,
  total_seconds integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sds_squad_date ON public.squad_daily_sessions(squad_id, session_date DESC);

CREATE TABLE public.squad_daily_session_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.squad_daily_sessions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  prioritization text,
  seconds_spent integer NOT NULL DEFAULT 0,
  position integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sdsc_session ON public.squad_daily_session_clients(session_id);
CREATE INDEX idx_sdsc_client ON public.squad_daily_session_clients(client_id);

CREATE TABLE public.squad_daily_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL,
  skip_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(squad_id, skip_date)
);
CREATE INDEX idx_sdsk_squad_date ON public.squad_daily_skips(squad_id, skip_date DESC);

ALTER TABLE public.squad_daily_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_daily_session_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_daily_skips ENABLE ROW LEVEL SECURITY;

-- Sessions
CREATE POLICY "Admins manage sessions" ON public.squad_daily_sessions
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Members view sessions" ON public.squad_daily_sessions
  FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert sessions" ON public.squad_daily_sessions
  FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update sessions" ON public.squad_daily_sessions
  FOR UPDATE TO authenticated USING (user_in_squad(squad_id)) WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members delete sessions" ON public.squad_daily_sessions
  FOR DELETE TO authenticated USING (user_in_squad(squad_id));

-- Session clients
CREATE POLICY "Admins manage session clients" ON public.squad_daily_session_clients
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Members view session clients" ON public.squad_daily_session_clients
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.squad_daily_sessions s WHERE s.id = session_id AND user_in_squad(s.squad_id)));
CREATE POLICY "Members insert session clients" ON public.squad_daily_session_clients
  FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.squad_daily_sessions s WHERE s.id = session_id AND user_in_squad(s.squad_id)));
CREATE POLICY "Members update session clients" ON public.squad_daily_session_clients
  FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.squad_daily_sessions s WHERE s.id = session_id AND user_in_squad(s.squad_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.squad_daily_sessions s WHERE s.id = session_id AND user_in_squad(s.squad_id)));

-- Skips
CREATE POLICY "Admins manage skips" ON public.squad_daily_skips
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Members view skips" ON public.squad_daily_skips
  FOR SELECT TO authenticated USING (user_in_squad(squad_id));
CREATE POLICY "Members insert skips" ON public.squad_daily_skips
  FOR INSERT TO authenticated WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members update skips" ON public.squad_daily_skips
  FOR UPDATE TO authenticated USING (user_in_squad(squad_id)) WITH CHECK (user_in_squad(squad_id));
CREATE POLICY "Members delete skips" ON public.squad_daily_skips
  FOR DELETE TO authenticated USING (user_in_squad(squad_id));