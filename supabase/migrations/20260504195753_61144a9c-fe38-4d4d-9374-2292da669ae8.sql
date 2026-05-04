CREATE TABLE public.squad_daily_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id uuid NOT NULL,
  client_id uuid NOT NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  content text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_squad_daily_notes_squad_date ON public.squad_daily_notes(squad_id, note_date DESC);
CREATE INDEX idx_squad_daily_notes_client_date ON public.squad_daily_notes(client_id, note_date DESC);

ALTER TABLE public.squad_daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage daily notes" ON public.squad_daily_notes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members view daily notes" ON public.squad_daily_notes
  FOR SELECT TO authenticated
  USING (user_in_squad(squad_id));

CREATE POLICY "Members insert daily notes" ON public.squad_daily_notes
  FOR INSERT TO authenticated
  WITH CHECK (user_in_squad(squad_id));

CREATE POLICY "Members update daily notes" ON public.squad_daily_notes
  FOR UPDATE TO authenticated
  USING (user_in_squad(squad_id))
  WITH CHECK (user_in_squad(squad_id));

CREATE POLICY "Members delete daily notes" ON public.squad_daily_notes
  FOR DELETE TO authenticated
  USING (user_in_squad(squad_id));

CREATE TRIGGER squad_daily_notes_updated_at
  BEFORE UPDATE ON public.squad_daily_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();