
CREATE TABLE IF NOT EXISTS public.kp_comercial_sdr_goals (
  ghl_user_id text PRIMARY KEY,
  agendados integer NOT NULL DEFAULT 0,
  realizados integer NOT NULL DEFAULT 0,
  vendas integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.kp_comercial_sdr_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sdr goals"
  ON public.kp_comercial_sdr_goals FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin/manager insert sdr goals"
  ON public.kp_comercial_sdr_goals FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admin/manager update sdr goals"
  ON public.kp_comercial_sdr_goals FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admin/manager delete sdr goals"
  ON public.kp_comercial_sdr_goals FOR DELETE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE TRIGGER update_kp_comercial_sdr_goals_updated_at
  BEFORE UPDATE ON public.kp_comercial_sdr_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
